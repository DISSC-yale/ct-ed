import type {LineSeriesOption} from 'echarts/charts'
import {ColumnTable} from 'arquero'
import type {Entities} from '../data/load'
import {Panel, PlotInput} from '../parts/plot'
import {unique} from '../utils'
import type {ViewDef} from './view'

const colors = ['#2F8CBF', '#A3651E', '#72CED5', '#C4AB4B', '#7E1700', '#C8E9B6', '#1549A2']
const symbols = ['circle', 'triangle', 'diamond', 'rect', 'roundRect', 'pin', 'arrow']

function indexMap(data: ColumnTable, variable: string) {
  const levelMap: {[index: string]: number} = {}
  ;(
    data
      .ungroup()
      .rollup({l: `array_agg_distinct(d.${data.columnIndex(variable) === -1 ? 'level' : variable})`})
      .array('l')[0] as string[]
  ).forEach((l, i) => (levelMap[l] = i))
  return levelMap
}

function updateRanges(name: string, range: number[], data: ColumnTable) {
  const r = data
    .ungroup()
    .rollup({value: `[min(d.${name}), quantile(d.${name}, .97), max(d.${name})]`})
    .array('value')[0]
  range[0] = Math.min(range[0], r[0])
  range[1] = Math.max(range[1], r[1])
  range[2] = Math.max(range[2], r[2])
}

export function makeSeries(
  selectData: ColumnTable,
  view: ViewDef,
  refs: {panelX: string; panelY: string; lines: string; color: string; symbol: string; time: string; entity: string},
  entities: Entities,
) {
  const {panelX, panelY, color, symbol, lines, time, entity} = refs
  const xPanelLevels = panelX ? unique(selectData, panelX) : ['']
  const yPanelLevels = panelY ? unique(selectData, panelY) : ['']
  const data: LineSeriesOption[] = []
  const panels: Panel[] = []
  const baseSeries: LineSeriesOption = {
    type: 'line',
    symbolSize: 10,
    color: '',
    itemStyle: {opacity: 1},
    lineStyle: {width: 1, opacity: 1},
    emphasis: {
      focus: 'series',
      lineStyle: {
        width: 5,
        opacity: 1,
      },
    },
  }
  let index = -1
  const range = {
    x: [Infinity, -Infinity, -Infinity],
    y: [Infinity, -Infinity, -Infinity],
    panel: [1, 1],
  }
  const assignColors = lines && lines !== entity
  const colorMap = assignColors ? indexMap(selectData, lines) : {}
  const varIndices: {[index: string]: number} = {}
  const otherVars = [...new Set([panelX, panelY, color, symbol, lines, time, entity].filter(x => !!x))]
  const lineVars = [...new Set([color, symbol, lines].filter(x => !!x))]
  const aggLines = lines && lines !== entity

  if (view.time_agg == 'all') lineVars.push(time)
  if (color) lineVars.push(color)

  xPanelLevels.forEach((x, xi) => {
    yPanelLevels.forEach((y, yi) => {
      const label =
        (x !== '' ? view.x_panels + ': ' + (x || 0) + (y ? ', ' : '') : '') +
        (y !== '' ? view.y_panels + ': ' + (y || 0) : '')
      let d = selectData
      if (panelX) d = d.filter(`d.${panelX} == '${x}'`)
      if (panelY) d = d.filter(`d.${panelY} == '${y}'`)
      const yRefs = view.y.addTo(d, 'y')
      const xRefs = view.x.addTo(yRefs.data, 'x')
      d = xRefs.data
      if (aggLines) d = d.filter(`d.${lines} !== null`)
      if (!d.numRows()) return
      const panelEntities = unique(d, entity)
      index++
      if (aggLines) {
        d = d
          .groupby(lines, time)
          .rollup({...yRefs.aggers, ...xRefs.aggers})
          .groupby(lines)
          .select(xRefs.names, yRefs.names, time, lines)
      } else if (lineVars.includes(entity)) {
        d = d.select(xRefs.names, yRefs.names, lineVars).groupby(entity)
      } else {
        d = d
          .groupby(lineVars)
          .rollup({...yRefs.aggers, ...xRefs.aggers})
          .select(xRefs.names, yRefs.names, lineVars)
      }
      d = d.reify()
      const keepVars = d.columnNames().filter(col => otherVars.includes(col))
      keepVars.forEach((v, i) => (varIndices[v] = i + 2))
      xRefs.names.forEach((sx, sxi) => {
        yRefs.names.forEach((sy, syi) => {
          const vars = [sx, sy, ...keepVars]
          varIndices[sx] = 0
          varIndices[sy] = 1
          d.partitions().forEach(inds => {
            const series = {...baseSeries, xAxisIndex: index, yAxisIndex: index} as LineSeriesOption
            series.name = label
            series.id = `${sx}.${sxi}.${sy}.${syi}.${x}${xi}${y}${yi}`
            if (lines) {
              const lineLevel = d.get(lines, inds[0])
              const entity = entities[lineLevel]
              if (entity) {
                series.id += entity.id
                series.name = entity.name
                series.color = entity.color
              } else {
                series.id += series.name = '' + lineLevel
              }
            }
            if (assignColors) {
              const colorLevel = d.get(color || lines, inds[0])
              if (!lines) {
                series.id += '' + colorLevel
                series.name = '' + colorLevel
              }
              series.color = colors[colorMap[colorLevel]]
            }
            if (sy.startsWith('y_')) {
              const labels = view.y.category.variables[sy.replace('y_', '')].labels
              series.name += (series.name ? ', ' : '') + `${labels.category}`
              if (!series.color) {
                series.color = colors[syi % 7]
              } else {
                series.symbol = symbols[syi % 7]
              }
            }
            if (sx.startsWith('x_')) {
              const labels = view.x.category.variables[sx.replace('x_', '')].labels
              series.name += (series.name ? ', ' : '') + `${labels.category}`
              if (!series.color) {
                series.color = colors[sxi % 7]
              } else if (!series.symbol) {
                series.symbol = symbols[sxi % 7]
              }
            }
            if (!series.color) series.color = colors[0]
            if (!series.symbol) series.symbol = symbols[0]
            const seriesData: (string | number)[][] = []
            series.data = seriesData
            inds.forEach(i => {
              const data = vars.map(col => d.get(col, i))
              if (data[0] != null && data[1] != null) seriesData.push(data)
            })
            data.push(series)
          })
        })
      })
      panels.push({
        label,
        top: 0,
        height: 0,
        left: 0,
        width: 0,
        yIndex: yi,
        nXLevels: 1,
        xIndex: xi,
        nYLevels: 1,
        panelEntities,
      })
      yRefs.names.forEach(name => updateRanges(name, range.y, d))
      xRefs.names.forEach(name => updateRanges(name, range.x, d))
    })
  })
  const indices: {x: Set<number>; y: Set<number>} = {x: new Set(), y: new Set()}
  panels.forEach(p => {
    indices.x.add(p.xIndex)
    indices.y.add(p.yIndex)
  })
  range.panel = [indices.x.size, indices.y.size]
  return {
    series: data,
    panels: panels.map(p => {
      p.nXLevels = range.panel[0]
      p.nYLevels = range.panel[1]
      return p
    }),
    range,
    varIndices,
  } as PlotInput
}
