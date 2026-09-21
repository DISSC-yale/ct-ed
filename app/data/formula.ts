import type {ColumnTable} from 'arquero'
import {unique} from '../utils'

export type FormulaParam = {label: string; category: string; note?: string; used_by: string[]} & (
  | {value: number; step_size?: number; min?: number; max?: number}
  | {reference: string; operator: string; value: number[][]; step_size?: number[]}
)
type FormulaParams = {
  [key: string]: FormulaParam
}
export type ParamValues = {[key: string]: number | number[][]}
type ActiveParams = {[key: string]: number | string}
export type FormulaSpec = {
  section: string
  params: FormulaParams
  param_history: {[key: string]: ActiveParams}
  steps: {[key: string]: string}
}
type FormulaStep = {params: string[]; parents: string[]; children: string[]; equation: string}

const rowFun = /row_(min|max|mean|median|sum)\((.*)\)(?:\s|$)/g
const paramPattern = /p\.([a-zA-Z_]+)/g
const listSep = /,\s*/g

export class Formula {
  section: string
  param_history: {[key: string]: ActiveParams}
  param_specs: FormulaParams
  params: ActiveParams
  steps: Map<string, FormulaStep>
  values: ParamValues
  refs: {entity: string; time: string}
  min_time = 0
  apply_after = 2025

  constructor(spec: Partial<FormulaSpec>, refs?: {entity: string; time: string}) {
    this.section = spec.section || ''
    this.param_history = spec.param_history ? spec.param_history : {}
    this.param_specs = spec.params ? JSON.parse(JSON.stringify(spec.params)) : {}
    this.params = {}
    this.values = {}
    this.steps = new Map()
    this.refs = refs || {entity: '', time: ''}
    Object.keys(this.param_specs).forEach(name => {
      const param = this.param_specs[name]
      const {reference, operator} = param as {reference: string; operator: string}
      this.params[name] =
        Array.isArray(param.value) ?
          '(' +
          param.value
            .map(t => {
              const col = `d.${reference}`
              return `${col}${operator}${t[0]} ? ${t[1]} : `
            })
            .join('') +
          '0)'
        : param.value
      param.used_by = []
      this.values[name] = Array.isArray(param.value) ? JSON.parse(JSON.stringify(param.value)) : param.value
    })
    const steps = spec.steps || {}
    Object.keys(steps).forEach(name => {
      const {p, eq, translated} = this.extractParams(steps[name])
      const entry: FormulaStep = {
        params: p,
        parents: [],
        children: [],
        equation: translated,
      }
      entry.params.forEach(p => {
        if (p in this.param_specs) {
          this.param_specs[p].used_by.push(name)
        } else {
          console.error(`parameter ${p} not found`)
        }
      })
      this.steps.forEach((s, n) => {
        if (eq.includes(`s.${n}`)) {
          s.children.push(name)
          entry.parents.push(n)
        }
      })
      this.steps.set(name, entry)
    })
  }
  reset() {
    Object.keys(this.param_specs).forEach(name => {
      const {value} = this.param_specs[name]
      this.values[name] = Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : value
    })
    return this.values
  }
  extractParams(e: string) {
    const p: string[] = []
    let eq = e
    let m
    while ((m = paramPattern.exec(e))) {
      const pName = m[1]
      if ('string' === typeof this.params[pName]) {
        eq = eq.replace(m[0], this.params[pName])
      }
      p.push(pName)
    }
    let translated = eq.replaceAll('d.', `d.${this.section}`).replaceAll('s.', 'd.computed__')
    while ((m = rowFun.exec(translated))) {
      translated = translated.replace(
        m[0],
        `row_${m[1]}(compact(Object.values(row_object('${m[2].replaceAll('d.', '').split(listSep).join("','")}')))) `,
      )
    }
    return {p, eq, translated}
  }
  appendStep(
    name: string,
    time: number,
    state: {
      data: ColumnTable
      updated: {[key: string]: boolean}
    },
  ) {
    const {updated} = state
    const step = this.steps.get(name) as FormulaStep
    if (name in updated) return step
    updated[name] = true
    const isPrior = name.endsWith('_prior')
    let data = state.data
    if (!isPrior) {
      step.parents.forEach(parent => {
        if (!updated[parent]) this.appendStep(parent, time, state)
      })
    }
    if (time in this.param_history) {
      const params = {...this.values}
      const historical = this.param_history[time]
      Object.keys(historical).forEach(param => {
        params[param] = historical[param] as number
      })
      data = data.params({p: params}) as ColumnTable
    } else {
      data = data.params({p: this.values}) as ColumnTable
    }
    const colName = `computed__${name}`
    const timeFilter = `d.${this.refs.time} === ${time}`
    let eq = step.equation
    if (isPrior) {
      if (time < this.apply_after || time === this.min_time) {
        eq = eq.split('|')[1]
      } else {
        state.data = data
          .filter(timeFilter)
          .lookup(
            data.filter(`d.${this.refs.time} === ${time - 1}`).derive({[colName]: eq.split('|')[0]}),
            this.refs.entity,
            colName,
          )
        return step
      }
    }
    data = data.filter(timeFilter)
    if (name.endsWith('_agg')) {
      const aggTable = data.groupby(this.refs.time).rollup({[colName]: eq})
      state.data = data.lookup(aggTable, this.refs.time, colName)
    } else {
      state.data = data.derive({[colName]: eq})
    }
    return step
  }
  run(sequence: string[], data: ColumnTable, values?: ParamValues, partial?: boolean) {
    if (values) this.values = values
    if (!sequence.length) this.steps.forEach((_, name) => sequence.push(name))
    const times = unique(data, this.refs.time).sort((a, b) => b - a)
    this.min_time = times[times.length - 1]
    const columns = data.columnNames()
    const calculatedCols: {[key: string]: string} = {}
    const absentCols: {[key: string]: string} = {}
    sequence.forEach(col => {
      const name = `computed__${col}`
      calculatedCols[name] = 'null'
      if (!columns.includes(name)) {
        absentCols[name] = 'null'
      }
    })
    data = data.derive(calculatedCols)
    if (partial) return data
    const state = {data: data, updated: {}}
    for (let i = times.length; i--; ) {
      const time = times[i]
      sequence.forEach(name => {
        const step = this.appendStep(name, time, state)
        // step.children.forEach(child => {
        //   this.appendStep(child, time, state)
        // })
      })
      Object.keys(calculatedCols).forEach(col => {
        const d = data.column(col) as number[]
        const s = state.data.column(col) as number[]
        state.data.scan(i => {
          d[i as number] = s[i as number]
        })
      })
      state.data = data
      state.updated = {}
    }
    return state.data
  }
}
