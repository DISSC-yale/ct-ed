import {from, type ColumnTable} from 'arquero'
import type {LineSeriesOption} from 'echarts'
import type {Variable} from './data/variable'

const formatter = Intl.NumberFormat().format
export function formatValue(x: number, info?: Variable): string | number | undefined {
  if (
    ('number' !== typeof x && x != null) ||
    (info && info.category.firstInstance && info.category.firstInstance.type === 'time')
  ) {
    return x
  }
  if (x == null) return 'NA'
  return (
    x % 1 === 0 ? formatter(x)
    : Math.abs(x) > 1e3 ? formatter(+(x + Number.EPSILON).toFixed(2))
    : +(x + Number.EPSILON).toFixed(2)
  )
}

export function unique(d: ColumnTable, variable: string) {
  return [...new Set(d.array(variable))].filter(x => x != null).sort()
}

export function tooltipPlacer(pos: number[], params: LineSeriesOption, dom: HTMLElement) {
  const tooltipRect = dom.getBoundingClientRect()
  const halfSize = tooltipRect.width / 2
  const setPosition = {
    top: pos[1] - (pos[1] < window.innerHeight / 2 ? -40 : tooltipRect.height + 40),
    left:
      pos[0] -
      (pos[0] > halfSize ?
        window.innerWidth - pos[0] > halfSize ?
          halfSize
        : halfSize * 2
      : -30),
  }
  return setPosition
}

// from https://data.bls.gov/pdq/SurveyOutputServlet
export const CPI_U = new Map([
  [2018, 252.146],
  [2019, 256.558],
  [2020, 259.918],
  [2021, 273.567],
  [2022, 296.171],
  [2023, 307.026],
  [2024, 314.796],
  [2025, 323.976],
  [2026, 334.98],
  [2027, 334.98],
])

export function deflatorTable() {
  const t = from(CPI_U, ['year', 'cpi_u'])
  return t.derive({general__cpi_u_deflator: `max(d.cpi_u) / d.cpi_u`}).select(['year', 'general__cpi_u_deflator'])
}
