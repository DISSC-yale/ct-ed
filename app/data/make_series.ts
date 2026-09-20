import type {LineSeriesOption} from 'echarts/charts'
import {ColumnTable} from 'arquero'
import type {Entities} from '../data/load'
import {Panel, PlotInput} from '../parts/plot'
import {unique} from '../utils'
import type {ViewDef} from './view'

const colors = ['#A3651E', '#2F8CBF', '#C4AB4B', '#72CED5', '#C8E9B6', '#7E1700', '#1549A2']
const symbols = ['triangle', 'diamond', 'rect', 'roundRect', 'pin', 'arrow', 'circle']

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
  const symbolMap: {[index: string]: {symbol: string; opacity: number}} = {}
  const baseSeries: LineSeriesOption = {
    type: 'line',
    symbolSize: 10,
    color: color || lines ? '' : '#a5cdff',
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
  const lineVars = [...new Set([color, symbol, lines].filter(x => !!x))]
  const aggLines = lines && lines !== entity

  if (view.time_agg == 'all') lineVars.push(time)
  if (color) lineVars.push(color)
  if (color && symbol) {
    lineVars.push(symbol)
    unique(selectData, symbol).forEach((l, i) => {
      symbolMap[l] = {
        symbol: symbols[i % 7],
        opacity: 0.8,
      }
    })
  }

  xPanelLevels.forEach((x, xi) => {
    yPanelLevels.forEach((y, yi) => {
      const label =
        (x !== '' ? view.x_panels + ': ' + (x || 0) + (y ? ', ' : '') : '') +
        (y !== '' ? view.y_panels + ': ' + (y || 0) : '')
      let d = selectData
      if (panelX) d = d.filter(`d.${panelX} == '${x}'`)
      if (panelY) d = d.filter(`d.${panelY} == '${y}'`)
      d = view.y.addTo(d, 'y')
      d = view.x.addTo(d, 'x')
      d = d.filter(`d.x != null & d.y != null`)
      if (aggLines) d = d.filter(`d.${lines} !== null`)
      if (!d.numRows()) return
      const panelEntities = unique(d, entity)
      index++
      if (aggLines) {
        d = d.groupby(lines, time).rollup({x: 'mean(d.x)', y: 'mean(d.y)'}).groupby(lines).select('x', 'y', time, lines)
      } else if (lineVars.includes(entity)) {
        d = d.select('x', 'y', lineVars).groupby(entity)
      } else {
        d = d.groupby(lineVars).rollup({x: 'mean(d.x)', y: 'mean(d.y)'}).select('x', 'y', lineVars)
      }
      d = d.reify()
      d.columnNames().forEach((v, i) => (varIndices[v] = i))
      const dataArray: number[][] = []
      d.partitions().forEach(inds => {
        const series = {...baseSeries, xAxisIndex: index, yAxisIndex: index} as LineSeriesOption
        series.name = label
        series.id = `${x}.${xi},${y}.${yi}`
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
          if (symbol) {
            series.name += ', ' + d.get(symbol, inds[0])
            const symbolId = d.get(symbol, inds[0])
            const symbolData = symbolMap[symbolId]
            series.id += symbolId
            series.symbol = symbolData.symbol
            if (series.lineStyle && series.itemStyle) {
              series.lineStyle.opacity = series.itemStyle.opacity = symbolData.opacity
            }
          } else {
            series.symbol = 'circle'
          }
        }
        const seriesData: (string | number)[][] = []
        series.data = seriesData
        inds.forEach(i => {
          const data = Object.values(d.object(i))
          dataArray.push([data[0], data[1]])
          seriesData.push(data)
        })
        data.push(series)
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
      const y_range = d.ungroup().rollup({value: '[min(d.y), quantile(d.y, .97), max(d.y)]'}).array('value')[0]
      range.y[0] = Math.min(range.y[0], y_range[0])
      range.y[1] = Math.max(range.y[1], y_range[1])
      range.y[2] = Math.max(range.y[2], y_range[2])
      const x_range = d.ungroup().rollup({value: '[min(d.x), quantile(d.x, .97), max(d.x)]'}).array('value')[0]
      range.x[0] = Math.min(range.x[0], x_range[0])
      range.x[1] = Math.max(range.x[1], x_range[1])
      range.x[2] = Math.max(range.x[2], x_range[2])
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
