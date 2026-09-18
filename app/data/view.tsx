import {type ActionDispatch, createContext, useContext, useEffect, useMemo, useReducer, useState} from 'react'
import {background, DataContext, Resources, type VariableInfo} from './load'
import {ColumnTable} from 'arquero'
import {Variable} from './variable'
import {Formula, type ParamValues} from './formula'

export type Variants = 'raw' | 'log' | 'percent'
export type TimeAgg = 'all' | 'first' | 'specified' | 'last' | 'mean' | 'median'
export type ViewDef = {
  lock_range: boolean
  x: Variable
  y: Variable
  lines: string
  color: string
  symbol: string
  x_panels: string
  y_panels: string
  time_agg: TimeAgg
  select_time: string
  entity_center: boolean
  entities: string
  entities_select: {[index: string]: boolean}
  min_time: string
  max_time: string
  profile: string
  profile_section: string
}

export type ViewAction =
  | {key: 'reset' | 'flip_panels'}
  | {key: 'replace'; view: ViewDef}
  | {key: 'x' | 'y'; value: Variable}
  | {key: 'variable'; which: 'x' | 'y'; part: 'selection'; value: VariableInfo[]}
  | {key: 'variable'; which: 'x' | 'y'; part: 'deflate'; value: boolean}
  | {
      key: 'lines' | 'color' | 'symbol' | 'x_panels' | 'y_panels' | 'select_time' | 'profile' | 'profile_section'
      value: string
    }
  | {key: 'time_agg'; value: TimeAgg}
  | {key: 'lock_range' | 'entity_center'; value: boolean}
  | {key: 'min_time' | 'max_time'; value: string}
  | {key: 'entities'; value: {[index: string]: boolean}}

const defaultView: ViewDef = {
  lock_range: true,
  x: new Variable('general__fiscal_year'),
  y: new Variable('computed__entitlement'),
  lines: 'general__district_code',
  color: '',
  symbol: '',
  x_panels: '',
  y_panels: '',
  time_agg: 'all',
  select_time: '2025',
  entity_center: false,
  entities: '',
  entities_select: {},
  min_time: '',
  max_time: '',
  profile: '',
  profile_section: 'sp',
}
const defaultXY = {x: defaultView.x.toString(), y: defaultView.y.toString()}
const binaryParams = {lock_range: true, entity_center: true}

const defaultParams = {...defaultView}
export function viewToString(view: ViewDef) {
  const p: string[] = []
  Object.keys(view).forEach(v => {
    if (v === 'entities_select') return
    if (v === 'x' || v === 'y') {
      const value = view[v].toString()
      if (value !== defaultXY[v]) {
        p.push(v + '=' + value)
      }
    } else {
      const value = view[v as 'color']
      if (value !== defaultParams[v as 'color']) {
        p.push(v + '=' + value)
      }
    }
  })
  return '?' + p.join('&')
}
const updateUrlParams = (view: ViewDef) => {
  requestAnimationFrame(() => window.history.replaceState(void 0, '', viewToString(view)))
}

export const ViewActionContext = createContext<ActionDispatch<[action: ViewAction]>>(() => {})
export const ViewContext = createContext<ViewDef | null>(null)
export const SelectedContext = createContext(new ColumnTable({}))

export const splitComponents = ['x_panels', 'y_panels', 'symbol', 'color']
const timeSelectors = {
  first: 'min',
  last: 'max',
}

export const FormulaContext = createContext<ParamValues>({})
export const FormulaEditor = createContext<ActionDispatch<[action: FormulaEditAction]>>(() => {})
export type FormulaEditAction =
  | {key: 'param'; which: string; value: number}
  | {key: 'param'; which: string; value: number[]; index: number}
  | {key: 'set'; value: ParamValues}

export function DataView({children}: Readonly<{children?: React.ReactNode}>) {
  const {info, categories, selectEntities, data} = useContext(DataContext) as Resources
  const formula = background.formula as Formula
  const urlParams = useMemo(() => {
    if (!defaultParams.min_time) {
      defaultView.min_time = defaultParams.min_time = '' + info.time_range.min
      defaultView.max_time = defaultParams.max_time = '' + info.time_range.max
    }
    defaultParams.x = new Variable(defaultParams.x, categories)
    defaultParams.y = new Variable(defaultParams.y, categories)
    const params = {...defaultParams}
    const search = window.location.search
    if (search) {
      search
        .substring(1)
        .split('&')
        .forEach(a => {
          const parts = a.split('=')
          const e = parts[0] as keyof ViewDef
          if (e in params) {
            if (e in binaryParams) {
              params[e as 'lock_range'] = parts.length === 1 || parts[1] === 'true'
            } else if ('x' === e || 'y' === e) {
              params[e] = new Variable(parts[1], categories)
            } else {
              params[e as 'color'] = parts[1]
            }
          }
        })
    }
    return params
  }, [!!info.time_range])
  const editView = (state: ViewDef, action: ViewAction) => {
    if (action.key === 'replace') {
      updateUrlParams({...urlParams, ...action.view})
      return {...action.view}
    }
    const newState = {...state}
    if (action.key === 'reset') {
      newState.entities_select = {...selectEntities}
      newState.time_agg = 'all'
      newState.max_time = '' + info.time_range.max
      newState.min_time = '' + info.time_range.min
    } else if (action.key === 'entities') {
      newState.entities = Object.keys(action.value).length < 10 ? Object.keys(action.value).join(',') : ''
      newState.entities_select = {...action.value}
    } else if (action.key === 'variable') {
      if (action.part === 'selection') {
        newState[action.which].setSelection(action.value)
      } else if (action.part === 'deflate') {
        newState[action.which].deflate = action.value
      }
    } else if (action.key === 'flip_panels') {
      newState.x_panels = state.y_panels
      newState.y_panels = state.x_panels
    } else if ('value' in action) {
      newState[action.key as 'color'] = action.value as string
    }
    updateUrlParams({...urlParams, ...newState})
    return newState
  }
  const urlParamsToView = (urlParams: ViewDef) => {
    const initial = {...defaultView, x: defaultView.x.copy(), y: defaultView.y.copy()}
    Object.keys(urlParams).forEach(k => {
      if (k in initial) initial[k as 'color'] = urlParams[k as 'color']
    })
    initial.entities_select = (() => {
      if (urlParams.entities) {
        const selectEntities: {[index: string]: boolean} = {}
        urlParams.entities.split(',').forEach(c => (selectEntities[c] = true))
        return selectEntities
      } else {
        return {...selectEntities}
      }
    })()
    return initial
  }
  const [view, viewAction] = useReducer(editView, urlParamsToView(urlParams))

  const [calculated, setCalculated] = useState(data)

  const editParams = (state: ParamValues, action: FormulaEditAction) => {
    if (action.key === 'set') {
      const newState = {...action.value}
      return newState
    } else {
      if ('index' in action) {
        ;(state[action.which] as number[][])[action.index as number] = [...action.value]
      } else {
        state[action.which] = action.value
      }
    }
    return {...state}
  }
  const [formulaParams, formulaAction] = useReducer(editParams, formula.values)
  useEffect(() => setCalculated(formula.run([], calculated, formulaParams)), [formulaParams])

  const selected = useMemo(() => {
    const entity_id = info.refs.entity
    const time_id = info.refs.time
    const filtered = calculated
      .params({e: view.entities_select})
      .filter(`(d, p) => d.${entity_id} in p.e`)
      .filter(
        view.time_agg === 'specified' ?
          `d.${time_id} === ` + (view.select_time || info.time_range.max)
        : `d.${time_id} >= ${view.min_time || info.time_range.min} && d.${time_id} <= ${view.max_time || info.time_range.max}`,
      )
    return view.time_agg in timeSelectors ?
        filtered.groupby(entity_id).filter(`d.${time_id} === ${timeSelectors[view.time_agg as 'first']}(d.${time_id})`)
      : filtered
  }, [calculated, view.entities_select, view.time_agg, view.select_time, info.time_range, view.min_time, view.max_time])

  return (
    <ViewActionContext.Provider value={viewAction}>
      <ViewContext.Provider value={view}>
        <FormulaEditor.Provider value={formulaAction}>
          <FormulaContext.Provider value={formulaParams}>
            <SelectedContext.Provider value={selected}>{children}</SelectedContext.Provider>
          </FormulaContext.Provider>
        </FormulaEditor.Provider>
      </ViewContext.Provider>
    </ViewActionContext.Provider>
  )
}
