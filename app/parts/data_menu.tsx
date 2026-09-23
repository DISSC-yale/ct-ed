import {
  Box,
  Button,
  CardActions,
  CardContent,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import {useContext, useMemo} from 'react'
import {DataContext, type Resources} from '../data/load'
import {ViewActionContext, ViewContext, ViewDef} from '../data/view'
import {FilterEntities} from './filter_entities'
import {FlipCameraAndroid} from '@mui/icons-material'
import VariableControls from '../data/variable_controls'
import {SingleSelect, type SelectOption} from './selector_single'

const categoryRank = {
  Revenue: 1,
  Expenditures: 2,
  Spending: 2,
  'Education Cost Sharing': 3,
  'ECS Formula Components': 3,
  'Computed Formula Components': 4,
  Computed: 4,
  'School Demographic and Performance': 5,
  Enrollment: 5,
  'Smarter Balanced Assessment': 6,
  'Graduation 4-Year': 7,
  'Special Education': 8,
}
export function sectionOrder(section: string) {
  return categoryRank[section as 'Revenue'] || 99
}

export function DataMenu() {
  const view = useContext(ViewContext) as ViewDef
  const viewAction = useContext(ViewActionContext)
  const full = useContext(DataContext) as Resources
  const allVariables = useMemo(() => {
    return Object.values(full[view.advanced ? 'categories' : 'selectCategories'])
      .map(cat => {
        cat.searchString = JSON.stringify({key: cat.key, ...cat.parts, ...cat.labels})
        return cat
      })
      .sort((a, b) => sectionOrder(a.labels.section) - sectionOrder(b.labels.section))
  }, [full.categories, full.selectCategories, view.advanced])
  const lineOptions = useMemo(() => {
    const options: {[key: string]: SelectOption} = {}
    ;[
      full.info.refs.entity,
      ...full.variable_types.categorical.map(x => x.id),
      ...full.variable_types.binary.map(x => x.id),
    ].forEach(id => {
      options[id] = {
        key: id,
        label: id in full.variables ? full.variables[id].labels.full : id,
      } as SelectOption
    })
    return options
  }, [full.variable_types, full.variables, full.info.refs.entity])
  const options = Object.values(lineOptions)
  const showPanelControls = !!view.x_panels || !!view.y_panels
  return (
    <>
      <CardContent sx={{overflow: 'hidden', height: 'calc(100% - 60px)', pt: 0, pb: 0}}>
        <Box sx={{overflowY: 'auto', height: '100%'}}>
          <Stack spacing={1}>
            <Typography variant="h6">Variables</Typography>
            <FormControlLabel
              label="Advanced"
              labelPlacement="start"
              sx={{'& .MuiFormControlLabel-root': {mt: 0}}}
              control={
                <Switch
                  size="small"
                  checked={view.advanced}
                  onChange={() => viewAction({key: 'advanced', value: !view.advanced})}
                />
              }
            />
            {view.advanced ?
              <Stack direction="row" sx={{alignItems: 'center'}}>
                <Stack spacing={1} sx={{width: 'calc(100% - 40px)'}}>
                  <Typography>Y-Axis</Typography>
                  <VariableControls
                    name="y"
                    variable={view.y}
                    allVariables={allVariables}
                    categories={full.categories}
                  />
                  <Typography>X-Axis</Typography>
                  <VariableControls
                    name="x"
                    variable={view.x}
                    allVariables={allVariables}
                    categories={full.categories}
                  />
                </Stack>
                <IconButton aria-label="flip axes" onClick={() => viewAction({key: 'flip_axes'})}>
                  <FlipCameraAndroid />
                </IconButton>
              </Stack>
            : <VariableControls
                name="y"
                variable={view.y}
                allVariables={allVariables}
                categories={full.selectCategories}
              />
            }
            {view.advanced ?
              <>
                <Typography>Lines</Typography>
                <SingleSelect
                  label="Level Source"
                  options={options}
                  selection={lineOptions[view.lines] || ''}
                  update={(value: SelectOption | null) => viewAction({key: 'lines', value: value ? value.key : ''})}
                  clearable={true}
                />
                <Typography>Panels</Typography>
                <Stack direction="row" sx={{alignItems: 'center'}}>
                  <Stack spacing={1} sx={{width: showPanelControls ? 'calc(100% - 40px)' : '100%'}}>
                    <SingleSelect
                      label="Y Levels"
                      options={options}
                      selection={lineOptions[view.y_panels] || ''}
                      update={(value: SelectOption | null) =>
                        viewAction({key: 'y_panels', value: value ? value.key : ''})
                      }
                      clearable={true}
                    />
                    {showPanelControls && (
                      <SingleSelect
                        label="X Levels"
                        options={options}
                        selection={lineOptions[view.x_panels] || ''}
                        update={(value: SelectOption | null) =>
                          viewAction({key: 'x_panels', value: value ? value.key : ''})
                        }
                        clearable={true}
                      />
                    )}
                    {showPanelControls && (
                      <FormControlLabel
                        label="Common Axis Ranges"
                        labelPlacement="start"
                        control={
                          <Switch
                            size="small"
                            checked={view.lock_range}
                            onChange={() => viewAction({key: 'lock_range', value: !view.lock_range})}
                          />
                        }
                      />
                    )}
                  </Stack>
                  {showPanelControls && (
                    <IconButton
                      aria-label="flip panel axes"
                      onClick={() => {
                        viewAction({key: 'flip_panels'})
                      }}
                    >
                      <FlipCameraAndroid />
                    </IconButton>
                  )}
                </Stack>
              </>
            : <></>}
            <Typography variant="h6">Filters</Typography>
            <FilterEntities />
            {view.advanced || view.time_agg !== 'all' ?
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
            : <></>}
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
