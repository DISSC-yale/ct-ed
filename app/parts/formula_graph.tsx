import {Box, useColorScheme} from '@mui/material'
import {useEffect, useMemo, useRef} from 'react'
import {background} from '../data/load'
import {use, init, getInstanceByDom} from 'echarts/core'
import {GraphChart} from 'echarts/charts'
import type {Formula} from '../data/formula'

const itemStyles = {
  Paramerter: {color: '#b3b3b3'},
  Step: {color: '#72a4ff'},
}

export default function FormulaGraph() {
  const formula = background.formula as Formula
  const {mode} = useColorScheme()
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    use([GraphChart])
    const chart = container.current ? init(container.current, mode, {renderer: 'canvas'}) : null
    const resize = () => chart && chart.resize()
    window.addEventListener('resize', resize)
    return () => {
      if (chart) chart.dispose()
      window.removeEventListener('resize', resize)
    }
  }, [mode])
  const series = useMemo(() => {
    const data: {
      id: string
      name: string
      description: string
      category: 'Parameter' | 'Step'
      value: string | number | number[][]
    }[] = []
    const links: {source: string; target: string; value?: number | number[][]}[] = []
    Object.keys(formula.param_specs).forEach(param => {
      const p = formula.param_specs[param]
      const id = 'p.' + param
      data.push({
        id,
        name: id,
        description: p.label,
        category: 'Parameter',
        value: p.value,
      })
      p.used_by.forEach(step =>
        links.push({
          source: id,
          target: 's.' + step,
          value: p.value,
        }),
      )
    })
    formula.steps.forEach((step, name) => {
      const id = 's.' + name
      data.push({
        id,
        name: id,
        category: 'Step',
        description: id,
        value: step.equation,
      })
      step.parents.forEach(parent =>
        links.push({
          source: 's.' + parent,
          target: id,
        }),
      )
    })
    return {data, links}
  }, [formula])
  useEffect(() => {
    if (container.current) {
      const chart = getInstanceByDom(container.current)
      if (chart) {
        const {data, links} = series
        const darkMode = mode === 'dark'
        const colors = darkMode ? {bg: '#121212', text: '#ffffff'} : {bg: '#ffffff', text: '#000000'}
        chart.setOption(
          {
            legend: {
              align: 'right',
              right: 'right',
              orient: 'vertical',
              type: 'plain',
              pageButtonGap: 10,
            },
            tooltip: {
              confine: true,
              appendToBody: true,
              formatter: (item: {
                marker: string
                name: string
                value: number
                data: {description: string; value: string | number | number[][]}
              }) => {
                return item.marker + item.data.description + '</br><span>' + item.value + '</span>'
              },
            },
            backgroundColor: colors.bg,
            series: [
              {
                type: 'graph',
                layout: 'force',
                data,
                links,
                categories: [
                  {name: 'Parameter', itemStyle: itemStyles.Paramerter},
                  {name: 'Step', itemStyle: itemStyles.Step},
                ],
                roam: true,
                label: {
                  show: true,
                  position: 'top',
                },
                emphasis: {
                  focus: 'adjacency',
                  itemStyle: {opacity: 1},
                  label: {opacity: 1},
                  lineStyle: {
                    width: 10,
                    opacity: 1,
                  },
                },
                blur: {
                  itemStyle: {opacity: 0.3},
                  lineStyle: {opacity: 0.3},
                  label: {opacity: 0.3},
                },
                edgeSymbol: ['circle', 'arrow'],
                edgeSymbolSize: [4, 10],
                draggable: true,
                lineStyle: {
                  color: 'source',
                },
              },
            ],
          },
          true,
          true,
        )
      }
    }
  }, [mode])
  return <Box ref={container} sx={{width: '100%', height: '100%', minHeight: '10px'}} />
}
