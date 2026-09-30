import {type ActionDispatch, createContext, useCallback, useContext, useMemo, useReducer} from 'react'
import {DataContext, Resources, type Entities} from './load'
import {ColumnTable} from 'arquero'
import {Variable, type VariableInfo} from './variable'
import type {ActiveParams} from './formula'

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
  advanced: boolean
  formula_params: ActiveParams
}

type Operator = 'none' | '-' | '*' | '/'

type VariableAction = {key: 'variable'; which: 'x' | 'y'} & (
  | {part: 'selection'; value: VariableInfo[]}
  | {part: 'agg'; value: string}
  | {part: 'deflate' | 'multi' | 'scale' | 'adjuster.remove'; value: boolean}
  | {part: 'adjuster'; value: {operator: Operator; variable: Variable}}
  | {part: 'adjuster.action'; action: ViewAction}
  | {part: 'adjuster.operator'; value: Operator}
  | {part: 'additional'; value: Variable}
  | {part: 'additional.remove'; value: number}
  | {part: 'additional.action'; index: number; action: ViewAction}
)

export type ViewAction =
  | {key: 'reset' | 'flip_panels' | 'flip_axes'}
  | {key: 'replace'; view: ViewDef}
  | {key: 'x' | 'y'; value: Variable}
  | VariableAction
  | {
      key: 'lines' | 'color' | 'symbol' | 'x_panels' | 'y_panels' | 'select_time' | 'profile' | 'profile_section'
      value: string
    }
  | {key: 'time_agg'; value: TimeAgg}
  | {key: 'lock_range' | 'entity_center' | 'advanced'; value: boolean}
  | {key: 'min_time' | 'max_time'; value: string}
  | {key: 'entities'; value: {[index: string]: boolean}}
  | {key: 'formula.set'; value: ActiveParams}
  | {key: 'formula'; which: string; value: number}

const binaryParams = {lock_range: true, entity_center: true, advanced: true}
const variableParams = {y_panels: true, x_panels: true, lines: true, colors: true}

export const ViewActionContext = createContext<ActionDispatch<[action: ViewAction]>>(() => {})
export const ViewContext = createContext<ViewDef | null>(null)
export const FullDataContext = createContext(new ColumnTable({}))
export const SelectedContext = createContext(new ColumnTable({}))

const timeSelectors = {
  first: 'min',
  last: 'max',
}

function applyVariableAction(variable: Variable, action: VariableAction) {
  if (action.part === 'selection') {
    variable.setSelection(action.value)
  } else if (action.part !== 'adjuster.action' && action.part !== 'additional.action') {
    variable[action.part as 'multi'] = action.value as boolean
    if (action.part === 'multi' && !action.value) {
      if (!variable.selection.length) {
        variable.selection = [variable.category.firstInstance as VariableInfo]
      } else if (variable.selection.length > 1) {
        variable.selection = [variable.selection[0]]
      }
    }
  }
}
function urlParamsToView(
  defaults: {view: ViewDef; url: ViewDef},
  selectEntities: {[key: string]: boolean},
  allEntities: Entities,
) {
  const initial = {...defaults.view, x: defaults.view.x.copy(), y: defaults.view.y.copy()}
  Object.keys(defaults.url).forEach(k => {
    if (k in initial) {
      const value = defaults.url[k as 'color' | 'x' | 'y' | 'formula_params']
      if ('object' === typeof value) {
        if (k === 'formula_params') {
          initial.formula_params = {...value} as ActiveParams
        } else if (k === 'x' || k === 'y') {
          initial[k] = new Variable(value as Variable)
        }
      } else {
        initial[k as 'color'] = value
      }
    }
  })
  initial.entities_select = (() => {
    if (defaults.url.entities) {
      const selectEntities: {[index: string]: boolean} = {}
      defaults.url.entities.split(',').forEach(c => {
        if (c in allEntities) {
          selectEntities[c] = true
        }
      })
      return selectEntities
    } else {
      return {...selectEntities}
    }
  })()
  return initial
}

export function DataView({children}: Readonly<{children?: React.ReactNode}>) {
  const {info, categories, meta, selectEntities, data, formula} = useContext(DataContext) as Resources
  const defaults = useMemo(() => {
    const view: ViewDef = {
      lock_range: false,
      x: new Variable('general__fiscal_year', categories),
      y: new Variable('iFcomputed__entitlement', categories),
      lines: 'general__district',
      color: '',
      symbol: '',
      x_panels: '',
      y_panels: '',
      time_agg: 'all',
      select_time: '2025',
      entity_center: false,
      entities: '',
      entities_select: {},
      min_time: '' + info.time_range.min,
      max_time: '' + info.time_range.max,
      profile: '',
      profile_section: 'rev',
      advanced: false,
      formula_params: formula.getValues(),
    }
    const xy = {x: view.x.toString(), y: view.y.toString()}
    const url = {...view} as ViewDef
    url.formula_params = {...url.formula_params}
    const search = window.location.search
    if (search) {
      search
        .substring(1)
        .split('&')
        .forEach(a => {
          const parts = a.split('=')
          const e = parts[0] as keyof ViewDef
          if (e in url.formula_params) {
            url.formula_params[e] = +parts[1]
          } else if (e !== 'formula_params' && e in url) {
            if (e in binaryParams) {
              url[e as 'lock_range'] = parts.length === 1 || parts[1] === 'true'
            } else if ('x' === e || 'y' === e) {
              url[e] = new Variable(parts[1], categories)
            } else if (e.endsWith('time')) {
              url[e as 'min_time'] =
                '' + (e === 'min_time' ? Math.max(+parts[1], +view.min_time) : Math.min(+parts[1], +view.max_time))
            } else if (e in variableParams) {
              url[e as 'lines'] = e in categories ? e : ''
            } else {
              url[e as 'color'] = parts[1]
            }
          }
        })
    }
    return {view, xy, url}
  }, [categories, info.time_range, formula])
  const updateUrlParams = useCallback(
    (view: ViewDef) => {
      const p: string[] = []
      Object.keys(view).forEach(v => {
        if (v === 'entities_select') return
        if (v === 'x' || v === 'y') {
          const value = view[v].toString()
          if (value !== defaults.xy[v]) {
            p.push(v + '=' + value)
          }
        } else if (v === 'formula_params') {
          const d = defaults.view.formula_params
          const params = view.formula_params
          Object.keys(params).forEach(paramName => {
            if (paramName in d && params[paramName] !== d[paramName]) {
              p.push(paramName + '=' + params[paramName])
            }
          })
        } else {
          const value = view[v as 'color']
          if (value !== defaults.view[v as 'color']) {
            p.push(v + '=' + value)
          }
        }
      })
      requestAnimationFrame(() => window.history.replaceState(void 0, '', '?' + p.join('&')))
    },
    [defaults.url, defaults.xy],
  )
  const editView = (state: ViewDef, action: ViewAction) => {
    if (action.key === 'replace') {
      updateUrlParams({...defaults.url, ...action.view})
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
      const variable = new Variable(newState[action.which], categories)
      if (action.part.startsWith('additional')) {
        if (action.part === 'additional') {
          variable.additional = [...newState[action.which].additional, action.value]
        } else if (action.part === 'additional.remove') {
          variable.additional = [...newState[action.which].additional]
          variable.additional.splice(action.value, 1)
        } else if (action.part === 'additional.action') {
          if (action.action.key === action.which) {
            variable.additional[action.index] = new Variable(action.action.value, categories)
          } else {
            applyVariableAction(variable.additional[action.index], action.action as VariableAction)
          }
        }
      } else if (action.part.startsWith('adjuster')) {
        if (action.part === 'adjuster') {
          variable.adjuster = action.value
        } else if (action.part === 'adjuster.remove') {
          delete variable.adjuster
        } else {
          if (!variable.adjuster) {
            variable.adjuster = {operator: 'none', variable: new Variable(variable.id, categories)}
          }
          const adjuster = variable.adjuster
          if (action.part === 'adjuster.operator') {
            adjuster.operator = action.value
          } else if (action.part === 'adjuster.action') {
            if (action.action.key === action.which) {
              adjuster.variable = action.action.value
            } else {
              applyVariableAction(adjuster.variable, action.action as VariableAction)
            }
          }
        }
      } else {
        applyVariableAction(variable, action)
      }
      newState[action.which] = variable
    } else if (action.key === 'flip_axes') {
      newState.x = state.y
      newState.y = state.x
    } else if (action.key === 'flip_panels') {
      newState.x_panels = state.y_panels
      newState.y_panels = state.x_panels
    } else if (action.key.startsWith('formula')) {
      if (action.key === 'formula.set') {
        newState.formula_params = action.value
      } else if (action.key === 'formula') {
        newState.formula_params[action.which] = action.value
      }
      newState.formula_params = {...newState.formula_params}
    } else if ('value' in action) {
      newState[action.key as 'color'] = action.value as string
    }
    updateUrlParams({...defaults.url, ...newState})
    return newState
  }
  const [view, viewAction] = useReducer(editView, urlParamsToView(defaults, selectEntities, meta.entities))
  const calculated = useMemo(() => formula.run([], data, view.formula_params), [formula, view.formula_params, data])
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
  }, [
    calculated,
    view.entities_select,
    view.time_agg,
    view.select_time,
    info.time_range,
    view.min_time,
    view.max_time,
    info.refs.entity,
    info.refs.time,
  ])

  return (
    <ViewActionContext.Provider value={viewAction}>
      <ViewContext.Provider value={view}>
        <FullDataContext.Provider value={calculated}>
          <SelectedContext.Provider value={selected}>{children}</SelectedContext.Provider>
        </FullDataContext.Provider>
      </ViewContext.Provider>
    </ViewActionContext.Provider>
  )
}
