import {useContext, useMemo} from 'react'
import {DataContext, Resources} from './load'
import {makeSeries} from './make_series'
import Plot, {PlotInput} from '../parts/plot'
import {SelectedContext, ViewContext, type ViewDef} from './view'
import {Variable} from './variable'

export function DataDisplay({mode}: {mode?: 'dark' | 'light'}) {
  const {info, meta, categories} = useContext(DataContext) as Resources
  const view = useContext(ViewContext) as ViewDef
  const selected = useContext(SelectedContext)
  if (!view.x.categories) view.x = new Variable(view.x, categories)
  if (!view.y.categories) view.y = new Variable(view.y, categories)
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
    [view, selected, !!meta.entities, !!info.refs],
  )

  return <Plot input={series as PlotInput} view={view} modeOverride={mode} />
}
