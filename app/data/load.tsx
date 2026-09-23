'use client'

import {ColumnTable, loadJSON} from 'arquero'
import {createContext, useEffect, useState} from 'react'
import {Backdrop, Stack, Typography} from '@mui/material'
import {initCustomFunctions, type Categories, type Category, type VariableInfo, type VariableTypes} from './variable'
import {Formula, type FormulaSpec} from './formula'
import {deflatorTable} from '../utils'

export type Info = {
  refs: {time: string; entity: string}
  time_range: {min: number; max: number}
  deflator: ColumnTable
}
export type Entities = {[index: string]: {id: string; name: string; color: string}}
export type Metadata = {
  updated: string
  types: {[key: string]: VariableTypes}
  select_variables: {section: string; variables: string[]}[]
  adjusters: {[key: string]: {label: string; applies_to: string; variable: string; function: string}}
  formula: FormulaSpec
  variable_parts: {[key: string]: {label: string}}
  entities: Entities
}
export type Resources = {
  meta: Metadata
  data: ColumnTable
  variables: {[key: string]: VariableInfo}
  categories: Categories
  selectCategories: Categories
  variable_types: {[key: string]: VariableInfo[]}
  info: Info
  selectEntities: {[key: string]: boolean}
}

export const DataContext = createContext<Resources | null>(null)

const dollarVars =
  /^(?:sp__(?:total|ppe|exp)|ppe__|tot__|rev__rev|ppo__|sped__|ecs__(?:actual|engl_3|engl_per|median|endo|region|full|entitlement|prior|change|base_formula|phase)|computed__(?:actual|mhi_agg|endo|engl_pc|engl_ag|region|grant|full|funding|entitlement|change|base_aid$))/
const percents = /_pct|_percent|_rate/
const firstLetters = /\b(\w)/g
type partLabels = {[key: string]: {label: string}}
function translatePart(p: string, parts: partLabels) {
  return p
    .split('_')
    .map(sp => (sp in parts ? parts[sp].label : sp.replaceAll(firstLetters, l => l.toUpperCase())))
    .join(' ')
}
function makeFullLabel(name: string, parts: partLabels) {
  const r = name.split('__')
  const p = r.map(f => translatePart(f, parts))
  return (
    (p[0] === p[1] || p[0] === 'General' ? p[1] : `${r[0].length < 5 ? r[0].toUpperCase() : p[0]}, ${p[1]}`) +
    (p.length > 2 ? ', ' + p[2] : '')
  )
}

export const background: {formula?: Formula} = {}

export function Data({children}: Readonly<{children?: React.ReactNode}>) {
  const [meta, setMeta] = useState<Metadata | null>(null)
  const [data, setData] = useState<ColumnTable | null>(null)
  useEffect(() => {
    loadJSON('data.json.gz').then(res => setData(res))
    fetch('metadata.json.gz').then(async res => {
      const blob = await res.blob()
      const metadata = await new Response(await blob.stream().pipeThrough(new DecompressionStream('gzip'))).json()
      setMeta(metadata)
    })
    initCustomFunctions()
  }, [])
  if (data && meta) {
    const variables: {[key: string]: VariableInfo} = {}
    const categories: Categories = {}
    const selCats: Categories = {}
    const variable_types: {[key: string]: VariableInfo[]} = {}
    const info: Info = {
      refs: {entity: '', time: ''},
      time_range: {min: 0, max: 0},
      deflator: deflatorTable(),
    }
    Object.keys(meta.types).forEach(col => {
      const type = meta.types[col]
      if (type === 'time') {
        info.refs.time = col
      } else if (type === 'entity_id') {
        info.refs.entity = col
      }
    })
    const selectMap: Map<string, [string, Category[]]> = new Map()
    meta.select_variables.forEach(s => {
      s.variables.forEach(v => selectMap.set(v, [s.section, []]))
    })
    const selectCheck = new RegExp('^(?:' + [...selectMap.keys()].join('|') + ')')
    background.formula = new Formula(meta.formula, info.refs)
    let newData = background.formula.run([], data, background.formula.values, true)
    const columns = newData.columnNames()
    columns.forEach(id => {
      const [section, variable, category] = id.split('__')
      const {variable_parts} = meta
      const category_id = `${section}__${variable}`
      const v = (variables[id] = {
        id,
        type:
          id in meta.types ? meta.types[id]
          : dollarVars.test(id) ? 'dollar'
          : percents.test(id) ? 'percent'
          : 'value',
        parts: {section, variable, category},
        labels: {
          section: translatePart(section, variable_parts),
          variable: translatePart(variable, variable_parts),
          category: category ? translatePart(category, variable_parts) : '',
          full: makeFullLabel(id, variable_parts),
        },
      }) as VariableInfo
      if (!(category_id in categories))
        categories[category_id] = {
          key: category_id,
          parts: {section, variable},
          labels: {section: v.labels.section, variable: v.labels.variable},
          levels: [],
          variables: {[id]: v},
          searchString: '',
          firstInstance: v,
        }
      const cat = categories[category_id]
      if (selectCheck.test(id)) {
        for (const pair of selectMap) {
          if (columns.includes(pair[0]) ? id === pair[0] : id.startsWith(pair[0])) {
            const selectCat = pair[1][0]
            const selectCatId = `${selectCat}__${variable}`
            if (!(selectCatId in selCats))
              selCats[selectCatId] = {
                key: category_id,
                parts: {section, variable},
                labels: {section: selectCat, variable: v.labels.variable},
                levels: [],
                variables: {[id]: v},
                searchString: '',
                firstInstance: v,
              }
            const selCat = selCats[selectCatId]
            pair[1][1].push(selCat)
            if (!(id in selCat.variables)) selCat.variables[id] = v
            if (v.parts.category) selCat.levels.push(v.parts.category)
            if (selectCat.startsWith('School') || selectCat.startsWith('Special')) {
              selCat.labels.variable = `${v.labels.section}, ${v.labels.variable}`
            }
            break
          }
        }
      }
      v.category = cat
      if (!(id in cat.variables)) cat.variables[id] = v
      if (v.parts.category) cat.levels.push(v.parts.category)
      if (!(v.type in variable_types)) variable_types[v.type] = []
      variable_types[v.type].push(v)
    })
    const selectCategories: Categories = {}
    selectMap.forEach(e => e[1].forEach(c => (selectCategories[c.key] = c)))
    newData = newData.lookup(info.deflator, info.refs.time)
    if ('time' in variable_types) {
      const id = variable_types.time[0].id
      const range = data
        .ungroup()
        .rollup({value: `[min(d.${id}), max(d.${id})]`})
        .array('value')[0]
      info.time_range.min = range[0]
      info.time_range.max = range[1]
    }
    if (meta.entities.id) {
      const entities = meta.entities as unknown as {[key: string]: string[]}
      meta.entities = {}
      entities.id.forEach((id, i) => {
        meta.entities[id] = {id, name: entities.name[i], color: entities.color[i]}
      })
    }
    const selectEntities: {[key: string]: boolean} = {}
    Object.keys(meta.entities).forEach(id => (selectEntities[id] = true))
    const full = {
      meta,
      data: newData,
      variables,
      categories,
      selectCategories,
      variable_types,
      info,
      selectEntities,
    }
    return <DataContext.Provider value={full}>{children}</DataContext.Provider>
  }
  return (
    <Backdrop open={true}>
      <Stack sx={{margin: 'auto', marginTop: 10, maxWidth: 350}}>
        <Typography variant="h5">Loading Data...</Typography>
      </Stack>
    </Backdrop>
  )
}
