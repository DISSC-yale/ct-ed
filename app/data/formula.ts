import type {ColumnTable} from 'arquero'
import {unique} from '../utils'

export type FormulaParam = {label: string; category: string; note?: string; used_by: string[]} & (
  | {value: number; step_size?: number; min?: number; max?: number}
  | {reference: string; operator: string; value: number[][]; step_size?: number[]}
)
type FormulaParams = {
  [key: string]: FormulaParam
}
export type BreakpointParam = {reference: string; operator: string; value: number[][]}
export type ParamValues = {[key: string]: number | BreakpointParam}
export type ActiveParams = {[key: string]: number | string}
export type FormulaSpec = {
  section: string
  params: FormulaParams
  steps: {[key: string]: string}
  param_history: {[key: string]: ParamValues}
  step_history: {[key: string]: {[key: string]: string}}
}
type FormulaStep = {
  params: string[]
  parents: string[]
  children: string[]
  data_refs: string[]
  equation: string
  equation_raw: string
}

const rowFun = /row_(min|max|mean|median|sum)\((.*)\)(?:\s|$)/g
const paramPattern = /p\.([a-zA-Z_]+)/g
const datarefPattern = /d\.([a-zA-Z0-9_]+)/g
const listSep = /,\s*/g

export class Formula {
  section: string
  step_history: {[key: string]: {[key: string]: string}}
  param_history: {[key: string]: ParamValues}
  param_offsets: {[key: string]: ParamValues}
  param_specs: FormulaParams
  params: ParamValues
  steps: Map<string, FormulaStep>
  values: ActiveParams
  refs: {entity: string; time: string}
  min_time = 0

  constructor(spec: Partial<FormulaSpec>, refs?: {entity: string; time: string}) {
    this.section = spec.section || ''
    this.step_history = spec.step_history ? JSON.parse(JSON.stringify(spec.step_history)) : {}
    this.param_history = spec.param_history ? spec.param_history : {}
    this.param_offsets = JSON.parse(JSON.stringify(this.param_history))
    this.param_specs = spec.params ? JSON.parse(JSON.stringify(spec.params)) : {}
    this.params = {}
    this.values = {}
    this.steps = new Map()
    this.refs = refs || {entity: '', time: ''}
    Object.keys(this.param_specs).forEach(name => {
      const param = this.param_specs[name]
      this.params[name] = 'number' === typeof param.value ? param.value : (param as BreakpointParam)
      param.used_by = []
      this.values[name] =
        'number' === typeof param.value ? param.value : renderBreakpointParam(param as BreakpointParam)
    })
    Object.keys(this.param_history).forEach(time => {
      const p = this.param_history[time]
      const offsets = this.param_offsets[time]
      Object.keys(p).forEach(name => {
        if (name in this.params) {
          const value = p[name]
          if ('object' === typeof value) {
            const current = this.params[name] as BreakpointParam
            const {reference, operator} = value
            const offsetValue =
              (
                current.reference === reference &&
                current.operator === operator &&
                current.value.length === value.value.length
              ) ?
                value.value.map((pair, i) => {
                  pair[1] = pair[1] - current.value[i][1]
                  return pair
                })
              : value.value
            offsets[name] = {...value, value: offsetValue}
          } else {
            offsets[name] = value - (this.values[name] as number)
          }
        }
      })
    })
    const steps = spec.steps || {}
    Object.keys(steps).forEach(name => {
      const equation = steps[name]
      const {p, eq, translated} = this.extractParams(equation)
      const entry: FormulaStep = {
        params: p,
        parents: [],
        children: [],
        data_refs: this.extractDataRefs(equation),
        equation: translated,
        equation_raw: equation,
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
    Object.keys(this.step_history).forEach(time => {
      const step_state = this.step_history[time]
      Object.keys(step_state).forEach(name => {
        step_state[name] = this.extractParams(step_state[name]).translated
      })
    })
  }
  reset() {
    Object.keys(this.param_specs).forEach(name => {
      const param = this.param_specs[name]
      this.values[name] =
        'number' === typeof param.value ? param.value : renderBreakpointParam(param as BreakpointParam)
    })
    return this.values
  }
  getValues() {
    const values: ActiveParams = {}
    Object.keys(this.param_specs).forEach(name => {
      const param = this.param_specs[name]
      values[name] = 'number' === typeof param.value ? param.value : renderBreakpointParam(param as BreakpointParam)
    })
    return values
  }
  extractParams(e: string) {
    const p: string[] = []
    const eq = e
    let m
    while ((m = paramPattern.exec(e))) p.push(m[1])
    let translated = eq.replaceAll('d.', `d.${this.section}`).replaceAll('s.', 'd.computed__')
    while ((m = rowFun.exec(translated))) {
      translated = translated.replace(
        m[0],
        `row_${m[1]}(compact(Object.values(row_object('${m[2].replaceAll('d.', '').split(listSep).join("','")}')))) `,
      )
    }
    return {p, eq, translated}
  }
  extractDataRefs(e: string) {
    const refs: string[] = []
    let m
    while ((m = datarefPattern.exec(e))) refs.push(m[1])
    return refs
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
    const isPrior = name.startsWith('prior_')
    let data = state.data
    if (!isPrior) {
      step.parents.forEach(parent => {
        if (!updated[parent]) this.appendStep(parent, time, state)
      })
    }
    if (time in this.param_offsets) {
      const params = {...this.values}
      const historical = this.param_offsets[time]
      Object.keys(historical).forEach(param => {
        const offset = historical[param]
        if ('number' === typeof offset) {
          params[param] = (params[param] as number) + offset
        } else {
          params[param] = renderBreakpointParam(offset)
        }
      })
      data = data.params({p: params}) as ColumnTable
    } else {
      data = data.params({p: this.values}) as ColumnTable
    }
    const params = (data.params() as {p: ActiveParams}).p
    const colName = `computed__${name}`
    const timeFilter = `d.${this.refs.time} === ${time}`
    const step_state = this.step_history[time]
    let eq = step_state && name in step_state ? step_state[name] : step.equation
    if (isPrior) {
      if (time < (params.calculated_prior_after as number) || time === this.min_time) {
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
    let m
    const e = eq
    while ((m = paramPattern.exec(e))) {
      const pName = m[1]
      if ('string' === typeof params[pName]) {
        eq = eq.replace(m[0], params[pName])
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
  run(sequence: string[], data: ColumnTable, values?: ActiveParams, partial?: boolean) {
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
        this.appendStep(name, time, state)
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

function renderBreakpointParam({reference, operator, value}: BreakpointParam) {
  return (
    '(' +
    value
      .map(t => {
        const col = `d.ecs__${reference}`
        return `${col}${operator}${t[0]} ? ${t[1]} : `
      })
      .join('') +
    '0)'
  )
}
