import {addFunction, addWindowFunction, type ColumnTable} from 'arquero'
import type {AggregateOperator} from 'arquero/dist/types/op/aggregate-functions'
import {statistics} from 'echarts-stat'

export type VariableTypes =
  | 'time'
  | 'entity_id'
  | 'entity_name'
  | 'weight'
  | 'binary'
  | 'categorical'
  | 'dollar'
  | 'percent'
  | 'value'

export type VariableInfo = {
  id: string
  type: VariableTypes
  parts: {section: string; variable: string; category: string}
  labels: {section: string; variable: string; category: string; full: string}
  category?: Category
}

export type Category = {
  key: string
  parts: {section: string; variable: string}
  labels: {section: string; variable: string}
  levels: string[]
  variables: {[key: string]: VariableInfo}
  searchString: string
  firstInstance?: VariableInfo
}
export type Categories = {[key: string]: Category}
type AdjusterVariable = {operator: 'none' | '-' | '*' | '/'; variable: Variable}
const operatorMap = {none: 'n', '-': 's', '*': 'm', '/': 'd'}
const operatorLabelMap = {none: 'and', '-': '-', '*': '*', '/': '/'}

export class Variable {
  id: string
  category: Category
  categories?: Categories
  selection: VariableInfo[]
  multi = false
  agg: 'none' | 'sum' | 'mean' | 'median' = 'none'
  crossAgg: 'sum' | 'mean' | 'median' = 'mean'
  scale: boolean = false
  deflate?: boolean
  firstType = 'value'
  adjuster?: AdjusterVariable
  additional: Variable[] = []

  constructor(spec: Variable | string, categories?: Categories, selection?: VariableInfo | VariableInfo[]) {
    if ('string' === typeof spec) spec = this.fromString(spec)
    if (selection) spec.selection = Array.isArray(selection) ? [...selection] : [selection]
    if (!categories && spec.categories) categories = spec.categories
    if (categories && !(spec.id in categories)) spec.id = 'computed__entitlement'
    this.id = spec.id
    const [section, name] = spec.id.split('__')
    this.category =
      categories && spec.id in categories ?
        categories[spec.id]
      : {
          key: spec.id,
          parts: {section, variable: name},
          labels: {section, variable: name},
          levels: [],
          variables: {},
          searchString: '',
          firstInstance: spec.category ? spec.category.firstInstance : undefined,
        }
    this.categories = categories || spec.categories
    if ('agg' in spec) this.agg = spec.agg
    if ('multi' in spec) this.multi = spec.multi
    if ('scale' in spec) this.scale = spec.scale
    if ('deflate' in spec) this.deflate = spec.deflate
    if ('firstType' in spec) this.firstType = spec.firstType
    if ('adjuster' in spec && spec.adjuster) {
      this.adjuster = spec.adjuster
      if (categories && !this.adjuster.variable.categories) {
        this.adjuster.variable = new Variable(this.adjuster.variable, this.categories)
      }
    }
    if ('additional' in spec) this.additional = spec.additional.map(v => new Variable(v, this.categories))
    if (categories && spec.selection && spec.selection.length) {
      this.selection = []
      spec.selection.forEach(cat => {
        if (cat.id in this.category.variables) this.selection.push(this.category.variables[cat.id])
      })
      if (this.selection.length) {
        if (!this.multi && this.selection.length > 1) this.multi = true
      } else if (this.multi || this.category.firstInstance) {
        this.selection =
          this.multi ? [...Object.values(this.category.variables)] : [this.category.firstInstance as VariableInfo]
      }
    } else {
      this.selection =
        spec.selection && spec.selection.length ? [...spec.selection]
        : this.category.levels.length ?
          this.multi ?
            [...Object.values(this.category.variables)]
          : [this.category.firstInstance as VariableInfo]
        : []
    }
    if (this.category.firstInstance) {
      this.firstType = this.category.firstInstance.type
    } else if (this.selection.length && this.firstType !== this.selection[0].type) {
      this.firstType = this.selection[0].type
    }
    if ('undefined' === typeof spec.deflate && this.firstType === 'dollar') {
      this.deflate = true
    }
  }
  formula() {
    let id =
      this.selection.length === 1 || !this.category.levels.length ?
        'd.' + (this.category.levels.length ? this.selection[0].id : this.id)
      : this.agg === 'none' ? 'null'
      : `row_${this.agg}(compact(Object.values(row_object('${this.getColNames().join("','")}'))))`
    if (this.deflate) id = `(${id} == null ? null : ${id} * d.general__cpi_u_deflator)`
    if (this.adjuster && this.adjuster.operator !== 'none') {
      id += ` ${this.adjuster.operator} (${this.adjuster.variable.formula()})`
    }
    return id
  }
  addTo(name: string, data: ColumnTable, isChild?: boolean) {
    const multiVar = isChild || this.additional.length
    const multiLevel = this.multi && this.selection.length > 1 && this.agg === 'none'
    if (multiVar || multiLevel) {
      const names: string[] = []
      const display: {[key: string]: string} = {}
      const formulas: {[key: string]: string} = {}
      const aggers: {[key: string]: string} = {}
      if (multiLevel) {
        this.selection.forEach(({id, labels}) => {
          const colName = `_${name}_${id}`
          names.push(colName)
          display[colName] = isChild || multiVar ? labels.full : labels.category
          formulas[colName] = `d.${id} == null ? null : d.${id}${this.deflate ? ' * d.general__cpi_u_deflator' : ''}`
          aggers[colName] = `${this.crossAgg}(d.${colName})`
          if (this.scale) {
            const rawName = colName + '_raw'
            names.push(rawName)
            formulas[rawName] = formulas[colName]
            formulas[colName] = `scale(${formulas[colName]})`
            aggers[rawName] = `${this.crossAgg}(d.${rawName})`
          }
        })
      } else {
        const colName = isChild ? name : '_' + name
        names.push(colName)
        display[colName] = isChild || multiVar ? this.label() : this.category.labels.variable
        formulas[colName] = this.formula()
        aggers[colName] = `${this.crossAgg}(d.${colName})`
        if (this.scale) {
          const rawName = colName + '_raw'
          names.push(rawName)
          formulas[rawName] = formulas[colName]
          formulas[colName] = `scale(${formulas[colName]})`
          aggers[rawName] = `${this.crossAgg}(d.${rawName})`
        }
      }
      if (multiVar) {
        this.additional.forEach((v, i) => {
          const colName = `_${name}${i}_`
          v.scale = this.scale
          const additions = v.addTo(colName, data, true)
          data = additions.data
          additions.names.forEach(n => names.push(n))
          Object.keys(additions.display).forEach(n => {
            display[n] = additions.display[n]
          })
          Object.keys(additions.aggers).forEach(n => {
            aggers[n] = additions.aggers[n]
          })
        })
      }
      return {names, display, aggers, data: data.derive(formulas)}
    }
    const names = [name]
    const f = {[name]: this.formula()}
    const aggers = {[name]: `${this.crossAgg}(d.${name})`}
    if (this.scale) {
      const rawName = name + '_raw'
      names.push(rawName)
      f[rawName] = f[name]
      f[name] = `scale(${f[name]})`
      aggers[rawName] = `${this.crossAgg}(d.${rawName})`
    }
    return {
      names,
      display: {[name]: this.category.labels.variable},
      aggers: aggers,
      data: data.derive(f),
    }
  }
  getColNames(access: string = '') {
    return (this.selection.length ? this.selection : Object.values(this.category.variables)).map(
      cat => `${access}${cat.id || this.category.key}`,
    )
  }
  setSelection(selection: VariableInfo | VariableInfo[]) {
    this.selection = Array.isArray(selection) ? [...selection] : [selection]
  }
  copy() {
    return new Variable(this)
  }
  fullId() {
    return this.selection.length && this.selection[0] ? this.selection[0].id : this.id
  }
  label(): string {
    const {section, variable} = this.category.labels
    const aggregated = this.agg !== 'none' && this.selection.length > 1
    return (
      (section === variable || section === 'General' ?
        variable
      : `${this.category.parts.section.length < 5 ? this.category.parts.section.toUpperCase() : section} ${variable}`) +
      (this.category.levels.length ?
        this.selection.length === 1 ? ` ${this.selection[0].labels.category}`
        : aggregated ? ` ${this.agg}(${this.selection.map(({labels}) => labels.category).join(' ')})`
        : ''
      : '') +
      (this.deflate ? ' (2026 $)' : '') +
      (this.adjuster && this.adjuster.operator !== 'none' ?
        ` ${operatorLabelMap[this.adjuster.operator]} ${this.adjuster.variable.label()}`
      : '')
    )
  }
  toString(): string {
    const flags = (this.deflate ? 'i' : '') + (this.scale ? 'z' : '')
    return (
      (flags ? flags + 'F' : '') +
      this.id +
      (this.category.levels.length && this.selection.length ?
        `[${this.selection.map(c => c.parts.category).join(',')}]` +
        (this.agg !== 'none' && this.selection.length > 1 ? `.${this.agg}` : '')
      : '') +
      (this.adjuster ? `-${operatorMap[this.adjuster.operator]}${this.adjuster.variable}` : '') +
      (this.additional.length ? ';' + this.additional.map(v => v.toString()).join(';') : '')
    )
  }
  fromString(spec: string) {
    const multi = spec.split(';')
    spec = multi.splice(0, 1)[0]
    const partial: Partial<Variable> = {}
    const adjusterParts = spec.split('-')
    const parts = adjusterParts[0].split('.')
    if (parts.length > 1) partial.agg = parts[1] as 'sum'
    const variableParts = parts[0].split('[')
    partial.id = variableParts[0]
    if (partial.id.includes('F')) {
      const flags = partial.id.split('F')
      partial.id = flags[1]
      partial.deflate = flags[0].includes('i')
      partial.scale = flags[0].includes('z')
    }
    if (this.categories && !(partial.id in this.categories)) {
      partial.id = Object.keys(this.categories)[0]
    }
    if (variableParts.length > 1) {
      partial.selection = variableParts[1]
        .replace(']', '')
        .split(',')
        .map(id =>
          this.category ? this.category.variables[id] : ({id: partial.id + '__' + id} as unknown as VariableInfo),
        )
    } else if (this.category && this.category.levels.length) {
      partial.selection = Object.values(this.category.variables)
    }
    if (adjusterParts.length > 1) {
      const map: {[key: string]: string} = {}
      Object.keys(operatorMap).forEach(to => (map[operatorMap[to as '-']] = to))
      const operator = map[adjusterParts[1].substring(0, 1)] as '-'
      if (operator) {
        partial.adjuster = {operator, variable: new Variable(adjusterParts[1].substring(1), this.categories)}
      }
    }
    if (multi.length) {
      partial.additional = multi.map(s => new Variable(s, this.categories))
    }
    return partial as Variable
  }
}

export function initCustomFunctions() {
  addFunction('row_min', (arr: number[]) => (arr.length ? statistics.min(arr) : null), {override: true})
  addFunction('row_max', (arr: number[]) => (arr.length ? statistics.max(arr) : null), {override: true})
  addFunction('row_sum', (arr: number[]) => (arr.length ? statistics.sum(arr) : null), {override: true})
  addFunction('row_mean', (arr: number[]) => (arr.length ? statistics.mean(arr) : null), {override: true})
  addFunction('row_median', (arr: number[]) => (arr.length ? statistics.median(arr.sort()) : null), {override: true})
  addFunction(
    'limit',
    (x: number | undefined, max: number) =>
      x == null ? null
      : x > max ? x
      : max,
    {override: true},
  )
  addFunction(
    'round',
    (x: number | undefined, digits: number) =>
      x == null ? null : +(x + Number.EPSILON).toFixed(Math.min(100, Math.max(0, digits))),
    {
      override: true,
    },
  )
  addWindowFunction(
    'scale',
    {
      create: () => {
        let mean: number | null = null
        let sd: number | null = null
        return {
          init: () => ((mean = null), (sd = null)),
          value: (
            w: {
              size: number
              index: number
              value: (index: number, get: (row: number, data: ColumnTable) => number) => number
            },
            f: (row: number, data: ColumnTable) => number,
          ) => {
            if (mean === null || sd === null) {
              const v = []
              for (let i = w.size; i--; ) v.push(w.value(i, f))
              mean = statistics.mean(v)
              sd = statistics.deviation(v)
            }
            const value = w.value(w.index, f)
            return value == null ? null : (((value - mean) / sd) as number)
          },
        } as unknown as AggregateOperator
      },
      param: [1, 0],
    },
    {
      override: true,
    },
  )
}
