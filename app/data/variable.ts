import {addFunction, type ColumnTable} from 'arquero'
import {statistics} from 'echarts-stat'
import type {VariableInfo} from './load'

export type Category = {
  key: string
  section: string
  variable: string
  labels: {section: string; variable: string}
  categories: VariableInfo[]
  searchString: string
  firstInstance?: VariableInfo | undefined
}
export type Categories = {[key: string]: Category}

export class Variable {
  id: string
  category: Category
  categories?: Categories
  selection: VariableInfo[]
  multi?: boolean
  agg?: 'sum' | 'mean' | 'median'
  deflate?: boolean
  firstType = 'value'

  constructor(spec: Variable | string, categories?: Categories) {
    if ('string' === typeof spec) spec = this.fromString(spec)
    if (!categories && spec.categories) categories = spec.categories
    this.id = spec.id
    const [section, name] = spec.id.split('__')
    this.category =
      categories && spec.id in categories ?
        categories[spec.id]
      : {
          key: spec.id,
          section,
          variable: name,
          labels: {section, variable: name},
          categories: [],
          searchString: '',
          firstInstance: spec.category ? spec.category.firstInstance : undefined,
        }
    this.categories = categories || spec.categories
    if ('agg' in spec) this.agg = spec.agg
    if ('multi' in spec) this.multi = spec.multi
    if ('deflate' in spec) this.deflate = spec.deflate
    if ('firstType' in spec) this.firstType = spec.firstType
    if (categories && spec.selection && spec.selection.length) {
      const categoryMap: {[key: string]: VariableInfo} = {}
      this.category.categories.forEach(cat => (categoryMap[cat.id] = cat))
      this.selection = []
      spec.selection.forEach(cat => {
        if (cat.id in categoryMap) spec.selection.push(categoryMap[cat.id])
      })
      if (!this.selection.length)
        this.selection = this.multi ? [...this.category.categories] : [this.category.categories[0]]
    } else {
      this.selection =
        spec.selection && spec.selection.length ? [...spec.selection]
        : this.category.categories.length ?
          this.multi ?
            [...this.category.categories]
          : [this.category.categories[0]]
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
  addTo(data: ColumnTable, name: string) {
    let id =
      this.selection.length < 2 ?
        'd.' + (this.category.categories.length > 1 ? this.selection[0].id : this.id)
      : `row_${this.agg || 'sum'}(compact(Object.values(row_object('${this.getColNames().join("','")}'))))`
    if (this.deflate) id = `(!${id} ? ${id} : ${id} * d.general__cpi_u_deflator)`
    return data.derive({[name]: id})
  }
  getColNames(access: string = '') {
    return (this.selection.length ? this.selection : this.category.categories).map(
      cat => `${access}${this.category.key}${cat.id ? '__' + cat.id : ''}`,
    )
  }
  setSelection(selection: VariableInfo | VariableInfo[]) {
    this.selection = Array.isArray(selection) ? [...selection] : [selection]
  }
  copy() {
    return new Variable(this)
  }
  label() {
    const {section, variable} = this.category.labels
    return (
      (section === variable || section === 'General' ? variable : `${section} - ${variable}`) +
      (this.category.categories.length > 1 ? ' - ' + this.selection[0].labels.category : '') +
      (this.deflate ? ' (2026 $)' : '')
    )
  }
  toString() {
    return (
      this.id +
      (this.category.categories.length > 1 && this.category.categories.length !== this.selection.length ?
        `[${this.selection.map(c => c.id).join(',')}]` + (this.agg ? `.${this.agg}` : '')
      : '')
    )
  }
  fromString(spec: string) {
    const partial: Partial<Variable> = {}
    const parts = spec.split('.')
    if (parts.length > 1) partial.agg = parts[1] as 'sum'
    const variableParts = parts[0].split('[')
    partial.id = variableParts[0]
    if (variableParts.length > 1)
      partial.selection = variableParts[1]
        .replace(']', '')
        .split(',')
        .map(id => {
          return {id, labels: {category: id}} as unknown as VariableInfo
        })
    return partial as Variable
  }
}

export function initCustomFunctions() {
  addFunction('row_min', (arr: number[]) => (arr.length ? statistics.min(arr) : null), {override: true})
  addFunction('row_max', (arr: number[]) => (arr.length ? statistics.max(arr) : null), {override: true})
  addFunction('row_sum', (arr: number[]) => (arr.length ? statistics.sum(arr) : null), {override: true})
  addFunction('row_mean', (arr: number[]) => (arr.length ? statistics.mean(arr) : null), {override: true})
  addFunction('row_median', (arr: number[]) => (arr.length ? statistics.median(arr) : null), {override: true})
  addFunction(
    'limit',
    (x: number | undefined, max: number) =>
      'undefined' === typeof x ? null
      : x > max ? x
      : max,
    {override: true},
  )
  addFunction(
    'round',
    (x: number | undefined, digits: number) =>
      'undefined' === typeof x ? null : +(x + Number.EPSILON).toFixed(digits),
    {
      override: true,
    },
  )
}
