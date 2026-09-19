import {useContext, useMemo} from 'react'
import {DataContext, Resources} from './load'
import {makeSeries} from './make_series'
import Plot, {PlotInput} from '../parts/plot'
import {SelectedContext, ViewContext, type ViewDef} from './view'

export function DataDisplay({mode}: {mode?: 'dark' | 'light'}) {
  const {info, meta} = useContext(DataContext) as Resources
  const view = useContext(ViewContext) as ViewDef
  const selected = useContext(SelectedContext)
  const series: PlotInput = useMemo(
    () =>
      makeSeries(
        selected,
        view,
        {
          panelX: view.x_panels,
          panelY: view.y_panels,
          lines: view.lines,
          color: view.color,
          symbol: view.symbol,
          time: info.refs.time,
          entity: info.refs.entity,
        },
        meta.entities,
      ),
    [view, selected, meta.entities, info.refs],
  )

  return <Plot input={series as PlotInput} view={view} modeOverride={mode} />
}
