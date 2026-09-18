import type {LineSeriesOption} from 'echarts/charts'
import {ColumnTable} from 'arquero'
import type {Info} from '../data/load'
import {Panel, PlotInput} from '../parts/plot'
import {unique} from '../utils'
import type {ViewDef} from './view'

const colors = ['#A3651E', '#2F8CBF', '#C4AB4B', '#72CED5', '#C8E9B6', '#7E1700', '#1549A2']
const symbols = ['triangle', 'diamond', 'rect', 'roundRect', 'pin', 'arrow', 'circle']

export function makeSeries(
  selectData: ColumnTable,
  view: ViewDef,
  refs: {panelX: string; panelY: string; lines: string; color: string; symbol: string},
  info: Info,
) {
  const {panelX, panelY, color, symbol} = refs
  const xPanelLevels = panelX ? unique(selectData, panelX) : ['']
  const yPanelLevels = panelY ? unique(selectData, panelY) : ['']
  const nXLevels = xPanelLevels.length
  const nYLevels = yPanelLevels.length
  const data: LineSeriesOption[] = []
  const panels: Panel[] = []
  const symbolMap: {[index: string]: {symbol: string; opacity: number}} = {}
  const lineVars: string[] = []

  if (view.time_agg == 'all') lineVars.push(info.refs.time)
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
  const baseSeries: LineSeriesOption = {
    type: 'line',
    symbolSize: 10,
    color: color ? '' : '#a5cdff',
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
    panel: [nXLevels, yPanelLevels.length],
  }
  const varIndices: {[index: string]: number} = {}
  const idVars = [...new Set([info.refs.time, refs.color, refs.symbol, refs.lines, info.refs.entity].filter(x => !!x))]
  const aggLines = refs.lines && refs.lines !== info.refs.entity

  const baseData = selectData
  xPanelLevels.forEach((x, xi) => {
    yPanelLevels.forEach((y, yi) => {
      let d = baseData
      if (panelX) d = d.filter(`d.${panelX} == '${x}'`)
      if (panelY) d = d.filter(`d.${panelY} == '${y}'`)
      d = view.y.addTo(d, 'y')
      d = view.x.addTo(d, 'x')
      d = d.filter(`d.x != null & d.y != null`)
      if (aggLines) d = d.filter(`d.${refs.lines} !== null`)
      if (!d.numRows()) return
      const nEntities = unique(d, info.refs.entity).length
      index++
      if (aggLines) {
        d = d
          .groupby(refs.lines, info.refs.time)
          .rollup({x: 'mean(d.x)', y: 'mean(d.y)'})
          .groupby(refs.lines)
          .select('x', 'y', info.refs.time, refs.lines)
      } else {
        d = d.select('x', 'y', idVars).groupby(info.refs.entity)
      }
      d = d.reify()
      d.columnNames().forEach((v, i) => (varIndices[v] = i))
      const dataArray: number[][] = []
      d.partitions().forEach(inds => {
        const series = {...baseSeries, xAxisIndex: index, yAxisIndex: index} as LineSeriesOption
        series.id = x + y + inds.join(',')
        if (refs.lines) {
          const lineLevel = d.get(refs.lines, inds[0])
          const entity = info.entities[lineLevel]
          series.id += entity ? entity.name : '' + lineLevel
          series.name = entity ? entity.name : '' + lineLevel
        } else if (color) {
          const colorLevel = d.get(color, inds[0])
          series.id += '' + colorLevel
          series.name = '' + colorLevel
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
        } else {
          series.name = 'series'
        }
        if (series.name) {
          const seriesData: (string | number)[][] = []
          series.data = seriesData
          inds.forEach(i => {
            const data = Object.values(d.object(i))
            dataArray.push([data[0], data[1]])
            seriesData.push(data)
          })
          data.push(series)
        }
      })
      panels.push({
        label: '',
        top: 0,
        height: 0,
        left: 0,
        width: 0,
        yIndex: yi,
        nYLevels,
        xIndex: xi,
        nXLevels,
        nEntities,
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
  return {series: data, panels, range, varIndices} as PlotInput
}
