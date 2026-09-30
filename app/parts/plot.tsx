'use client'

import {use, init, getInstanceByDom} from 'echarts/core'
import {BarChart, LineChart, type BarSeriesOption, type LineSeriesOption} from 'echarts/charts'
import {
  DatasetComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components'
import {useCallback, useContext, useEffect, useRef} from 'react'
import {CanvasRenderer} from 'echarts/renderers'
import {Box, useColorScheme} from '@mui/material'
import {formatValue, tooltipPlacer} from '../utils'
import type {Variable} from '../data/variable'
import {ViewActionContext, ViewDef} from '../data/view'
import {DataContext, type Resources} from '../data/load'

function axisMin({min}: {min: number}, adj = 1) {
  return +(
    min < 0 || min - adj > 0 ? min - adj + Number.EPSILON
    : min > 0.1 ? min + Number.EPSILON
    : 0).toFixed(2)
}
function axisMax({max}: {max: number}, adj = 1) {
  return +(max + adj + Number.EPSILON).toFixed(2)
}
function assignRanges(range: number[], options: AxisOptions, lock: boolean) {
  const adj = Math.max(0.01, Math.abs(range[0] - range[1]) * 0.01)
  if (lock) {
    options.min = +(range[0] - adj).toFixed(2)
    options.max = +(range[2] + adj).toFixed(2)
  } else {
    options.min = (params: {min: number}) => axisMin(params, adj)
    options.max = (params: {max: number}) => axisMax(params, adj)
  }
}
type AxisOptions = {
  min?: number | (({min}: {min: number}) => number)
  max?: number | (({max}: {max: number}) => number)
  axisLabel?: {formatter: (x: number) => string}
}
function formatValueAxis(x: number, variable: Variable) {
  if (variable.category.firstInstance && variable.category.firstInstance.type === 'time') return '' + Math.round(x)
  const x_abs = Math.abs(x)
  const ndec = x_abs < 1 ? 3 : 2
  return (
    x_abs > 1e3 ?
      x_abs > 2e9 ? x.toExponential(1)
      : x_abs > 1e9 ? (x / 1e9 + Number.EPSILON).toFixed(ndec) + 'B'
      : x_abs < 1e6 ? (x / 1e3 + Number.EPSILON).toFixed(ndec) + 'K'
      : (x / 1e6 + Number.EPSILON).toFixed(ndec) + 'M'
    : x_abs % 1 === 0 ? '' + x
    : (x + Number.EPSILON).toFixed(ndec)
  )
}
const baseYAxisOptions: AxisOptions = {
  min: axisMin,
  max: axisMax,
}
const baseXAxisOptions: AxisOptions = {}
export type Panel = {
  label: string
  top: number
  height: number
  left: number
  width: number
  legendWidth?: number
  yIndex: number
  nYLevels: number
  xIndex: number
  nXLevels: number
  panelEntities: string[]
}
export type PlotInput = {
  series: (LineSeriesOption | BarSeriesOption)[]
  panels: Panel[]
  range: {x: number[]; y: number[]; panel: number[]}
  varIndices: {[index: string]: number}
}
const panelSpacing = {
  textGapX: 30,
  textGapY: 50,
  top: 50,
  topNoLabel: 40,
  left: 120,
  bottom: 20,
  gapX: 73,
  gapY: 100,
  legendWidth: 0,
}
function resizePanels(frame: {height: number; width: number}, grid: Panel[]) {
  const topGap = panelSpacing[grid[0].label === '' ? 'topNoLabel' : 'top']
  const frameHeight = frame.height - (topGap + panelSpacing.bottom + panelSpacing.gapY * grid[0].nYLevels)
  const panelHeight = frameHeight / grid[0].nYLevels
  const frameWidth = frame.width - (panelSpacing.left + panelSpacing.legendWidth + panelSpacing.gapX * grid[0].nXLevels)
  const panelWidth = frameWidth / grid[0].nXLevels
  const title: {label: string; left: number; top: number; panelEntities: string[]}[] = []
  grid.forEach(g => {
    g.left = g.xIndex ? panelWidth * g.xIndex + panelSpacing.gapX * (g.xIndex + 1) + 20 : panelSpacing.left
    g.top = g.yIndex ? panelHeight * g.yIndex + panelSpacing.gapY * (g.yIndex + 1) - 35 : topGap
    g.height = panelHeight
    g.width = panelWidth
    title.push({
      label: g.label,
      left: g.left - panelSpacing.textGapX,
      top: g.top - panelSpacing.textGapY,
      panelEntities: g.panelEntities,
    })
  })
  return {title, grid}
}

function resolveId(name: string, id: string, variable: Variable) {
  if (id === '' || id === name) {
    return variable.fullId()
  }
  if (id.startsWith('_')) return id.replace('_', '')
  const index = +id.replace('_', '')
  if ('undefined' !== typeof index) return variable.additional[index].fullId()
  return id
}

export default function Plot({input, view}: {input: PlotInput; view: ViewDef}) {
  useEffect(() => {
    use([
      DatasetComponent,
      TitleComponent,
      GridComponent,
      TooltipComponent,
      ToolboxComponent,
      LegendComponent,
      LineChart,
      CanvasRenderer,
      GraphicComponent,
      BarChart,
    ])
  }, [])
  const {mode} = useColorScheme()
  const viewAction = useContext(ViewActionContext)
  const {info, meta, variables} = useContext(DataContext) as Resources
  const {series, panels, range, varIndices} = input
  const currentSeries = useRef(series)
  const indices = useRef<{[key: string]: number}>({})
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const chart = container.current ? init(container.current, mode, {renderer: 'canvas'}) : null
    const resize = () => {
      if (chart) {
        const frame = chart.getDom().getBoundingClientRect()
        const current = chart.getOption()
        const grid = current.grid as Panel[]
        if (grid && grid.length) {
          chart.setOption(resizePanels(frame, grid))
          chart.resize()
        }
      }
    }
    if (chart)
      chart.on('click', params => {
        if (params.componentType === 'legend') {
          const s = params.seriesIndex && currentSeries.current[params.seriesIndex]
          if (s && s.data) {
            const id = (s.data[0] as string[])[indices.current[info.refs.entity]]
            if (id in meta.entities) {
              viewAction({key: 'entities', value: {[id]: true}})
            }
          }
        } else if (Array.isArray(params.data)) {
          const id = params.data[indices.current[info.refs.entity]] as string
          if (id in meta.entities) {
            viewAction({key: 'profile', value: id})
          }
        }
      })
    window.addEventListener('resize', resize)
    return () => {
      if (chart) {
        chart.dispose()
      }
      window.removeEventListener('resize', resize)
    }
  }, [mode, info.refs.entity, meta.entities, viewAction])
  const formatter = useCallback(
    ({
      marker,
      seriesName,
      seriesId,
      value,
    }: {
      marker: string
      seriesName: string
      seriesId: string
      value: number[]
    }) => {
      const entity = info.refs.entity in indices.current && meta.entities[value[indices.current[info.refs.entity]]]
      const parts = seriesId.split('.')
      const xVar = resolveId('x', parts[0].replace('_x', ''), view.x)
      const yVar = resolveId('y', parts[2].replace('_y', ''), view.y)
      const xInfo = variables[xVar]
      const yInfo = variables[yVar]
      return (
        '<div class="tooltip-table">' +
        (view.lines ? marker + (entity ? entity.name + ' (' + entity.id + ')' : seriesName) : '') +
        '<table>' +
        (info.refs.time in indices.current && !(info.refs.time === view.x.id || info.refs.time === view.y.id) ?
          '<tr><td>' +
          variables[info.refs.time].labels.full +
          '</td><td><strong>' +
          value[indices.current[info.refs.time]] +
          '</strong></td></tr>'
        : '') +
        ('string' === typeof value[0] && value[0] === seriesName ?
          ''
        : '<tr><td>' +
          xInfo.labels.full +
          '</td><td><strong>' +
          formatValue(value[0], xInfo, view.x) +
          '</strong></td></tr>') +
        ('string' === typeof value[1] && value[1] === seriesName ?
          ''
        : '<tr><td>' +
          yInfo.labels.full +
          '</td><td><strong>' +
          formatValue(value[1], yInfo, view.y) +
          '</strong></td></tr>') +
        '</table></div>'
      )
    },
    [view, variables, meta.entities, info.refs.entity, info.refs.time],
  )
  useEffect(() => {
    if (container.current) {
      const chart = getInstanceByDom(container.current)
      if (chart) {
        if (series.length) {
          Object.keys(varIndices).forEach(k => (indices.current[k] = varIndices[k]))
          currentSeries.current = series
          const firstData = (series[0] as {data: number[][]}).data[0]
          const isBar = firstData && firstData.length && series[0].type === 'bar'
          const which =
            isBar ?
              series[0].name === firstData[0] ?
                1
              : 0
            : 0
          assignRanges(range.x, baseXAxisOptions, view.lock_range && (!isBar || which === 0))
          assignRanges(range.y, baseYAxisOptions, view.lock_range && (!isBar || which === 1))
          const darkMode = mode === 'dark'
          const colors = darkMode ? {bg: '#121212', text: '#ffffff'} : {bg: '#ffffff', text: '#000000'}
          panelSpacing.legendWidth = 0
          let legendName = ''
          if (!isBar) {
            if (view.lines && (view.lines !== info.refs.entity || Object.keys(view.entities_select).length > 1))
              legendName = variables[view.lines].labels.full
            if (view.x.additional.length || view.y.additional.length) {
              legendName += (legendName ? ', ' : '') + 'Variable'
            } else {
              if (view.y.multi && view.y.agg === 'none' && view.y.selection.length > 1)
                legendName += (legendName ? ', ' : '') + view.y.label()
              if (view.x.multi && view.x.agg === 'none' && view.x.selection.length > 1)
                legendName += (legendName ? ', ' : '') + view.x.label()
            }
            if (legendName) {
              series.forEach(s => {
                const len = (s.name as string).length
                if (len > panelSpacing.legendWidth) panelSpacing.legendWidth = len
              })
              panelSpacing.legendWidth += 4
              panelSpacing.legendWidth *= 4.6
            }
          }
          const frame = container.current.getBoundingClientRect()
          const labelSize = frame.height < 500 || frame.width < 800 ? 0.7 : 1
          const {title, grid} = resizePanels(frame, panels)
          const seriesNames = [...new Set(series.map(s => s.name).sort())]
          let s = series
          if (isBar) {
            s = series.sort((a, b) => {
              const aData = a.data && a.data.length ? (a.data[0] as number[]) : []
              const bData = b.data && b.data.length ? (b.data[0] as number[]) : []
              return (bData ? bData[which] : 0) - (aData ? aData[which] : 0)
            })
          }
          chart.setOption(
            {
              darkMode,
              legend: {
                top: '30',
                align: 'right',
                right: 'right',
                orient: 'vertical',
                type: 'scroll',
                data: seriesNames.length > 1 ? seriesNames : [],
                triggerEvent: true,
                silent: false,
              },
              backgroundColor: colors.bg,
              tooltip: {
                textStyle: {
                  color: colors.text,
                },
                backgroundColor: colors.bg + (darkMode ? '60' : ''),
                borderWidth: 0,
                axisPointer: {
                  type: 'none',
                },
                formatter,
                position: tooltipPlacer,
                appendToBody: true,
              },
              xAxis: panels.map((_, i) => {
                return isBar && which === 1 ?
                    {
                      type: 'category',
                      gridIndex: i,
                      axisLabel: {
                        rotate: 90,
                        overflow: 'truncate',
                        width: 90,
                      },
                      ...baseXAxisOptions,
                    }
                  : {
                      type: 'value',
                      gridIndex: i,
                      axisLabel: {
                        formatter: (x: number) => formatValueAxis(x, view.x),
                      },
                      ...baseXAxisOptions,
                    }
              }),
              yAxis: panels.map((_, i) => {
                return isBar && which === 0 ?
                    {
                      type: 'category',
                      gridIndex: i,
                      axisLabel: {
                        overflow: 'truncate',
                        width: 90,
                      },
                      ...baseYAxisOptions,
                    }
                  : {
                      type: 'value',
                      gridIndex: i,
                      axisLabel: {
                        formatter: (x: number) => formatValueAxis(x, view.y),
                      },
                      ...baseYAxisOptions,
                    }
              }),
              graphic: [
                {
                  type: 'text',
                  rotation: Math.PI / 2,
                  left: 15,
                  top: 'center',
                  width: '100%',
                  style: {
                    text:
                      isBar && which === 0 && view.lines ? variables[view.lines].labels.full
                      : view.y.additional.length ?
                        view.y.scale ?
                          'Z-Score'
                        : 'Raw Value'
                      : view.y.label(),
                    fill: colors.text,
                    font: `bold ${labelSize}em "Roboto","Helvetica","Arial",sans-serif`,
                    textAlign: 'center',
                  },
                },
                {
                  type: 'text',
                  left: 'center',
                  bottom: 15,
                  style: {
                    text:
                      isBar && which === 1 && view.lines ? variables[view.lines].labels.full
                      : view.x.additional.length ?
                        view.x.scale ?
                          'Z-Score'
                        : 'Raw Value'
                      : view.x.label(),
                    fill: colors.text,
                    font: `bold ${labelSize}em "Roboto","Helvetica","Arial",sans-serif`,
                    textAlign: 'center',
                  },
                },
                legendName ?
                  {
                    type: 'text',
                    top: 12,
                    right: 15,
                    bottom: 20,
                    style: {
                      text: legendName,
                      fill: colors.text,
                      font: `${labelSize * 0.8}em "Roboto","Helvetica","Arial",sans-serif`,
                      textAlign: 'right',
                    },
                  }
                : null,
              ],
              title: title.map(({label, top, left, panelEntities}) => {
                const nEntities = panelEntities.length
                return {
                  text: label,
                  subtext:
                    nEntities === 1 && panelEntities[0] in meta.entities ?
                      `Data from ${meta.entities[panelEntities[0]].name}`
                    : `Observations from ${nEntities} ${nEntities === 1 ? 'district' : 'districts'}`,
                  top,
                  left,
                  contain: true,
                  subtextStyle: {align: 'right', verticalAlign: 'center', width: '100%'},
                  textStyle: {fontSize: '1em', fontWeight: 'normal'},
                }
              }),
              grid,
              series: s,
              toolbox: {
                left: 0,
                bottom: 0,
                feature: {
                  saveAsImage: {
                    name: 'ct_ed_',
                  },
                },
              },
            },
            true,
            true,
          )
        } else {
          chart.clear()
        }
      }
    }
  }, [
    mode,
    panels,
    meta,
    series,
    view.x,
    view.y,
    view.lines,
    view.lock_range,
    info.refs.entity,
    variables,
    view.entities_select,
    formatter,
    range.x,
    range.y,
    varIndices,
  ])
  setTimeout(() => window.dispatchEvent(new Event('resize')), 100)
  return (
    <Box
      ref={container}
      sx={{
        width: '100%',
        height: '100%',
        minWidth: range.panel[0] * 500 + 'px',
        minHeight: range.panel[1] * 300 + 'px',
        overflow: 'hidden',
      }}
    />
  )
}
