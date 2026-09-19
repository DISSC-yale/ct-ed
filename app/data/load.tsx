'use client'

import {ColumnTable, loadJSON} from 'arquero'
import {createContext, useEffect, useState} from 'react'
import {Backdrop, Stack, Typography} from '@mui/material'
import {initCustomFunctions, type Categories} from './variable'
import {Formula, type FormulaSpec} from './formula'
import {deflatorTable} from '../utils'

export type Info = {
  refs: {time: string; entity: string}
  time_range: {min: number; max: number}
  deflator: ColumnTable
}
type VariableTypes = 'time' | 'entity_id' | 'entity_name' | 'weight' | 'binary' | 'categorical' | 'dollar' | 'value'
export type Entities = {[index: string]: {id: string; name: string; color: string}}
export type Metadata = {
  updated: string
  types: {[key: string]: VariableTypes}
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
  variable_types: {[key: string]: VariableInfo[]}
  info: Info
  selectEntities: {[key: string]: boolean}
}
export type VariableInfo = {
  id: string
  type: VariableTypes
  section: string
  variable: string
  category_id: string
  category: string
  labels: {section: string; variable: string; category: string; full: string}
  levels?: string[]
}

export const DataContext = createContext<Resources | null>(null)

const dollarVars =
  /^(?:sp__|ppe__|tot__|rev__rev|ppo__|sped__|ecs__(?:actual|engl_3|engl_per|engl|median|endo|region|full|entitlement|prior|change|base_formula|phase)|computed__(?:actual|median|base|endo|region|grant|full|funding|entitlement|change))/
const firstLetters = /\b(\w)/g
function translatePart(p: string, parts: {[key: string]: {label: string}}) {
  return p
    .split('_')
    .map(sp => (sp in parts ? parts[sp].label : sp.replaceAll(firstLetters, l => l.toUpperCase())))
    .join(' ')
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
    background.formula = new Formula(meta.formula, info.refs)
    let newData = background.formula.run([], data, background.formula.values, true)
    newData.columnNames().forEach(id => {
      const [section, variable, category] = id.split('__')
      const {variable_parts} = meta
      const v = (variables[id] = {
        id,
        type:
          id in meta.types ? meta.types[id]
          : dollarVars.test(id) ? 'dollar'
          : 'value',
        section,
        variable,
        category_id: `${section}__${variable}`,
        category,
        labels: {
          section: translatePart(section, variable_parts),
          variable: translatePart(variable, variable_parts),
          category: category ? translatePart(category, variable_parts) : '',
          full: id
            .split('__')
            .map(part => translatePart(part, variable_parts))
            .join(' - '),
        },
      })
      if (!(v.category_id in categories))
        categories[v.category_id] = {
          key: v.category_id,
          section,
          variable,
          labels: {section: v.labels.section, variable: v.labels.variable},
          categories: [],
          searchString: '',
          firstInstance: v,
        }
      v.category && categories[v.category_id].categories.push(v)
      if (!(v.type in variable_types)) variable_types[v.type] = []
      variable_types[v.type].push(v)
    })
    newData = newData.lookup(info.deflator, [info.refs.time, 'year'])
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
