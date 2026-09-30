import {Box, useColorScheme} from '@mui/material'
import {useContext, useEffect, useMemo, useRef} from 'react'
import {use, init, getInstanceByDom} from 'echarts/core'
import {GraphChart} from 'echarts/charts'
import {colors} from '../data/make_series'
import {DataContext, type Resources} from '../data/load'

export default function FormulaGraph() {
  const {formula} = useContext(DataContext) as Resources
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
      category: string
      value: string | number | number[][]
    }[] = []
    const links: {source: string; target: string; description: string; value: string | number | number[][]}[] = []
    const categoryTypes: {name: string; lineStyle: {color: string}}[] = []
    const categories: Set<string> = new Set()
    const dataRefs: Set<string> = new Set()
    Object.keys(formula.param_specs).forEach(param => {
      const p = formula.param_specs[param]
      const id = 'p.' + param
      data.push({
        id,
        name: id,
        description: p.label,
        category: p.category + ' Parameter',
        value: p.value,
      })
      p.used_by.forEach(step =>
        links.push({
          source: id,
          target: 's.' + step,
          description: `${id} -> s.${step}`,
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
        value: step.equation_raw,
      })
      step.parents.forEach(parent =>
        links.push({
          source: 's.' + parent,
          target: id,
          description: `s.${parent} -> ${id}`,
          value: '',
        }),
      )
      step.data_refs.forEach(data_ref => {
        dataRefs.add(data_ref)
        links.push({
          source: 'd.' + data_ref,
          target: id,
          description: `d.${data_ref} -> ${id}`,
          value: '',
        })
      })
    })
    dataRefs.forEach(name => {
      const id = 'd.' + name
      data.push({
        id,
        name: id,
        category: 'Data',
        description: name,
        value: '',
      })
    })
    data.forEach(d => categories.add(d.category))
    const colorSet = colors[mode === 'dark' ? 'dark' : 'light']
    ;[...categories].forEach((cat, i) => {
      categoryTypes.push({
        name: cat,
        lineStyle: {color: colorSet[i % 9]},
      })
    })
    return {data, links, categoryTypes}
  }, [formula, mode])
  useEffect(() => {
    if (container.current) {
      const chart = getInstanceByDom(container.current)
      if (chart) {
        const {data, links, categoryTypes} = series
        const darkMode = mode === 'dark'
        const baseColors = darkMode ? {bg: '#121212', text: '#ffffff'} : {bg: '#ffffff', text: '#000000'}
        chart.setOption(
          {
            legend: {
              align: 'right',
              top: 20,
              right: 20,
              orient: 'vertical',
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
            backgroundColor: baseColors.bg,
            series: [
              {
                type: 'graph',
                layout: 'force',
                data,
                links,
                categories: categoryTypes,
                roam: true,
                label: {
                  show: true,
                  position: 'top',
                },
                force: {
                  repulsion: 100,
                  gravity: 0.05,
                  edgeLength: 50,
                  friction: 0.5,
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
  }, [mode, series])
  return <Box ref={container} sx={{width: '100%', height: '100%', minHeight: '10px'}} />
}
