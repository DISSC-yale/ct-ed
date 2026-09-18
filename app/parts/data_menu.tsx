import {
  Box,
  Button,
  CardActions,
  CardContent,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {useContext, useMemo} from 'react'
import {DataContext, type Resources, type VariableInfo} from '../data/load'
import {ViewActionContext, ViewContext, ViewDef} from '../data/view'
import {FilterEntities} from './filter_entities'
import {FlipCameraAndroid} from '@mui/icons-material'
import VariableControls from '../data/variable_controls'
import {SingleSelect} from './selector_single'

function sectionOrder(section: string) {
  return (
    section === 'ecs' ? 0
    : section === 'computed' ? 1
    : 2
  )
}

export function DataMenu() {
  const view = useContext(ViewContext) as ViewDef
  const viewAction = useContext(ViewActionContext)
  const full = useContext(DataContext) as Resources
  const allVariables = useMemo(() => {
    return Object.values(full.categories)
      .map(cat => {
        cat.searchString = JSON.stringify(cat)
        return cat
      })
      .sort((a, b) => sectionOrder(a.section) - sectionOrder(b.section))
  }, [!!full.categories])
  const lineOptions = useMemo(() => {
    return [
      full.info.refs.entity,
      ...full.variable_types.categorical.map(x => x.id),
      ...full.variable_types.binary.map(x => x.id),
    ].map(level => {
      return {
        id: level,
        labels: {category: level in full.variables ? full.variables[level].labels.full : level},
      } as unknown as VariableInfo
    })
  }, [!!full.variable_types])
  return (
    <>
      <CardContent sx={{overflow: 'hidden', height: 'calc(100% - 60px)', pt: 0, pb: 0}}>
        <Box sx={{overflowY: 'auto', height: '100%', overflow: 'hidden'}}>
          <Stack spacing={2}>
            <Typography variant="h6">Variables</Typography>
            <Stack direction="row" sx={{alignItems: 'center'}}>
              <Stack spacing={1} sx={{width: 'calc(100% - 40px)'}}>
                <Typography>Y-Axis</Typography>
                <VariableControls name="y" variable={view.y} allVariables={allVariables} />
                <Typography>X-Axis</Typography>
                <VariableControls name="x" variable={view.x} allVariables={allVariables} />
              </Stack>
              <IconButton
                aria-label="flip axes"
                onClick={() => {
                  viewAction({key: 'x', value: view.y.copy()})
                  viewAction({key: 'y', value: view.x.copy()})
                }}
              >
                <FlipCameraAndroid />
              </IconButton>
            </Stack>
            <Typography>Lines</Typography>
            <SingleSelect
              label="Level Source"
              options={lineOptions}
              selection={
                lineOptions.find(({id}) => id === view.lines) ||
                ({
                  id: view.lines,
                  labels: {category: view.lines},
                } as unknown as VariableInfo)
              }
              update={(value: VariableInfo) => viewAction({key: 'lines', value: value.id})}
              clearable={true}
            />
            <Typography>Panels</Typography>
            <Stack direction="row" sx={{alignItems: 'center'}}>
              <Stack spacing={1} sx={{width: 'calc(100% - 40px)'}}>
                <SingleSelect
                  label="Y Levels"
                  options={lineOptions}
                  selection={
                    lineOptions.find(({id}) => id === view.y_panels) ||
                    ({
                      id: '',
                      labels: {category: ''},
                    } as unknown as VariableInfo)
                  }
                  update={(value: VariableInfo) => viewAction({key: 'y_panels', value: value.id})}
                  clearable={true}
                />
                <SingleSelect
                  label="X Levels"
                  options={lineOptions}
                  selection={
                    lineOptions.find(({id}) => id === view.x_panels) ||
                    ({
                      id: '',
                      labels: {category: ''},
                    } as unknown as VariableInfo)
                  }
                  update={(value: VariableInfo) => viewAction({key: 'x_panels', value: value.id})}
                  clearable={true}
                />
              </Stack>
              <IconButton
                aria-label="flip panel axes"
                onClick={() => {
                  viewAction({key: 'flip_panels'})
                }}
              >
                <FlipCameraAndroid />
              </IconButton>
            </Stack>
            <Typography variant="h6">Filters</Typography>
            <FilterEntities />
            <FormControl size="small" fullWidth>
              <InputLabel id="time_agg_select">Year Per District</InputLabel>
              <Select
                labelId="time_agg_select"
                label="Year Per District"
                value={view.time_agg}
                onChange={e => {
                  viewAction({key: 'time_agg', value: e.target.value as 'last'})
                }}
              >
                <MenuItem value="all">All Years</MenuItem>
                <MenuItem value="first">Earliest Year</MenuItem>
                <MenuItem value="specified">Specified Year</MenuItem>
                <MenuItem value="last">Latest Year</MenuItem>
              </Select>
            </FormControl>
            {view.time_agg === 'specified' ?
              <TextField
                label="Year"
                type="number"
                size="small"
                fullWidth
                value={view.select_time}
                slotProps={{htmlInput: {min: full.info.time_range.min, max: full.info.time_range.max, step: 1}}}
                onChange={e => viewAction({key: 'select_time', value: e.target.value})}
              />
            : <Stack direction="row" spacing={1}>
                <TextField
                  label="Min Year"
                  type="number"
                  size="small"
                  fullWidth
                  value={view.min_time}
                  slotProps={{htmlInput: {min: full.info.time_range.min, max: view.max_time, step: 1}}}
                  onChange={e => viewAction({key: 'min_time', value: e.target.value})}
                />
                <TextField
                  label="Max Year"
                  type="number"
                  size="small"
                  fullWidth
                  value={view.max_time}
                  slotProps={{htmlInput: {min: view.min_time, max: full.info.time_range.max, step: 1}}}
                  onChange={e => viewAction({key: 'max_time', value: e.target.value})}
                />
              </Stack>
            }
          </Stack>
          <Button fullWidth onClick={() => viewAction({key: 'reset'})}>
            Reset Filter
          </Button>
        </Box>
      </CardContent>
      <CardActions>
        <Button
          fullWidth
          color="error"
          size="small"
          onClick={() => {
            window.history.replaceState(void 0, '', window.location.origin + window.location.pathname)
            window.location.reload()
          }}
        >
          Hard Reset
        </Button>
      </CardActions>
    </>
  )
}
