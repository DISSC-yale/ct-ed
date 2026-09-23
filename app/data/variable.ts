import {addFunction, type ColumnTable} from 'arquero'
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
type AdditionalVariable = {operator: 'none' | '-' | '*' | '/'; variable: Variable}
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
  deflate?: boolean
  firstType = 'value'
  additional?: AdditionalVariable

  constructor(spec: Variable | string, categories?: Categories, selection?: VariableInfo | VariableInfo[]) {
    if ('string' === typeof spec) spec = this.fromString(spec)
    if (selection) spec.selection = Array.isArray(selection) ? [...selection] : [selection]
    if (!categories && spec.categories) categories = spec.categories
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
    if ('deflate' in spec) this.deflate = spec.deflate
    if ('firstType' in spec) this.firstType = spec.firstType
    if ('additional' in spec && spec.additional) {
      this.additional = spec.additional
      if (categories && !this.additional.variable.categories) {
        this.additional.variable = new Variable(this.additional.variable, categories)
      }
    }
    if (categories && spec.selection && spec.selection.length) {
      this.selection = []
      spec.selection.forEach(cat => {
        if (cat.id in this.category.variables) this.selection.push(this.category.variables[cat.id])
      })
      if (this.selection.length) {
        if (!this.multi && this.selection.length > 1) this.multi = true
      } else {
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
    if (this.deflate) id = `(${id} == null ? ${id} : ${id} * d.general__cpi_u_deflator)`
    return id
  }
  addTo(data: ColumnTable, name: string) {
    if (this.multi && this.selection.length > 1 && this.agg === 'none') {
      const names: string[] = []
      const formulas: {[key: string]: string} = {}
      const aggers: {[key: string]: string} = {}
      this.selection.forEach(({id}) => {
        const colName = `${name}_${id}`
        names.push(colName)
        formulas[colName] = `d.${id}${this.deflate ? ' * d.general__cpi_u_deflator' : ''}`
        aggers[colName] = `${this.crossAgg}(d.${colName})`
      })
      return {names, aggers, data: data.derive(formulas)}
    }
    let id = this.formula()
    if (this.additional && this.additional.operator !== 'none') {
      id += ` ${this.additional.operator} (${this.additional.variable.formula()})`
    }
    data = data.derive({[name]: id})
    return {names: [name], aggers: {[name]: `${this.crossAgg}(d.${name})`}, data}
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
      (this.additional ? ` ${operatorLabelMap[this.additional.operator]} ${this.additional.variable.label()}` : '')
    )
  }
  toString() {
    return (
      this.id +
      (this.category.levels.length && this.selection.length ?
        `[${this.selection.map(c => c.parts.category).join(',')}]` +
        (this.agg !== 'none' && this.selection.length > 1 ? `.${this.agg}` : '')
      : '') +
      (this.additional ? `-${operatorMap[this.additional.operator]}${this.additional.variable}` : '')
    )
  }
  fromString(spec: string) {
    const partial: Partial<Variable> = {}
    const additionalParts = spec.split('-')
    const parts = additionalParts[0].split('.')
    if (parts.length > 1) partial.agg = parts[1] as 'sum'
    const variableParts = parts[0].split('[')
    partial.id = variableParts[0]
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
    if (additionalParts.length > 1) {
      const map: {[key: string]: string} = {}
      Object.keys(operatorMap).forEach(to => (map[operatorMap[to as '-']] = to))
      const operator = map[additionalParts[1].substring(0, 1)] as '-'
      if (operator) {
        partial.additional = {operator, variable: new Variable(additionalParts[1].substring(1), this.categories)}
      }
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
}
