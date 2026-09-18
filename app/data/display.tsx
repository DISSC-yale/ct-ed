import {useContext, useMemo} from 'react'
import {DataContext, Resources} from './load'
import {makeSeries} from './make_series'
import Plot, {PlotInput} from '../parts/plot'
import {SelectedContext, ViewContext, type ViewDef} from './view'
import {Variable} from './variable'

function getColRef(ref: string) {
  return ref
}

export function DataDisplay({mode}: {mode?: 'dark' | 'light'}) {
  const {info, categories} = useContext(DataContext) as Resources
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
          panelX: getColRef(view.x_panels),
          panelY: getColRef(view.y_panels),
          lines: getColRef(view.lines),
          color: getColRef(view.color),
          symbol: getColRef(view.symbol),
        },
        info,
      ),
    [view, selected, !!info.entities, !!info.refs],
  )

  return <Plot input={series as PlotInput} view={view} modeOverride={mode} info={info} />
}
