import {Close} from '@mui/icons-material'
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import {useContext, useMemo, type ReactElement} from 'react'
import {DataContext, type Resources} from '../data/load'
import {entityOptions, filterOptions, type EntityOption} from './filter_entities'
import {ViewActionContext, ViewContext, type ViewDef} from '../data/view'
import {formatNumber} from '../utils'

function numberSummary(v: string) {
  return `[min(d.${v}), quantile(d.${v}, .25), median(d.${v}), mean(d.${v}), quantile(d.${v}, .75), max(d.${v})]`
}
function SummaryBar({value, summary}: {value: number; summary: number[]}) {
  return (
    <Stack
      sx={{position: 'relative', width: '100%', height: 35, justifyContent: 'space-between', alignItems: 'center'}}
      spacing={1}
      direction="row"
    >
      <Box
        sx={{
          opacity: 0.8,
          width: 100,
          textAlign: 'right',
        }}
      >
        {formatNumber(summary[0])}
      </Box>
      <Box sx={{backgroundColor: '#949494', height: 10, position: 'relative', width: '100%'}}>
        <Box
          sx={{
            position: 'absolute',
            backgroundColor: '#286dc0',
            height: 10,
            left: ((summary[1] - summary[0]) / (summary[5] - summary[0])) * 100 + '%',
            right: ((summary[4] - summary[0]) / (summary[5] - summary[0])) * 100 + '%',
          }}
        ></Box>
        <Box
          sx={{
            position: 'absolute',
            height: 10,
            width: 2,
            backgroundColor: '#b3b3b3',
            left: ((summary[3] - summary[0]) / (summary[5] - summary[0])) * 100 + '%',
          }}
        ></Box>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            height: 30,
            width: 2,
            backgroundColor: '#696969',
            lineHeight: 2.8,
            opacity: 0.8,
            textIndent: 5,
            left: ((summary[2] - summary[0]) / (summary[5] - summary[0])) * 100 + '%',
          }}
        >
          {formatNumber(summary[2])}
        </Box>
        <Box
          sx={{
            position: 'absolute',
            height: 30,
            width: 2,
            backgroundColor: '#ac4141',
            top: '-19px',
            textIndent: 5,
            left: value === null ? '50%' : ((value - summary[0]) / (summary[5] - summary[0])) * 100 + '%',
          }}
        >
          {formatNumber(value)}
        </Box>
      </Box>
      <Box
        sx={{
          opacity: 0.8,
          width: 100,
        }}
      >
        {formatNumber(summary[5])}
      </Box>
    </Stack>
  )
}
function SummaryRow({label, value, summary}: {label?: string; value: number; summary: number[]}) {
  return label ?
      <TableRow>
        <TableCell component="th" scope="row" sx={{width: 270}}>
          {label}
        </TableCell>
        <TableCell>
          <SummaryBar value={value} summary={summary} />
        </TableCell>
      </TableRow>
    : <TableRow>
        <TableCell>
          <SummaryBar value={value} summary={summary} />
        </TableCell>
      </TableRow>
}

export function ProfileDisplay() {
  const {info, data, variable_types, variables, categories} = useContext(DataContext) as Resources
  const view = useContext(ViewContext) as ViewDef
  const viewAction = useContext(ViewActionContext)
  const time = view.select_time || '' + 2025
  const allEntities: EntityOption[] = useMemo(
    () =>
      Object.keys(info.entities).map(id => {
        if (!(id in entityOptions)) {
          const entity = info.entities[id]
          entityOptions[id] = {key: id, searchString: JSON.stringify(entity), name: entity.name}
        }
        return entityOptions[id]
      }),
    [!!info.entities],
  )
  const summaries = useMemo(() => {
    const formulas: {[key: string]: string} = {}
    variable_types.dollar.forEach(({id}) => (formulas[id] = numberSummary(id)))
    variable_types.value.forEach(({id}) => (formulas[id] = numberSummary(id)))
    const summaries = data.ungroup().filter(`d.${info.refs.time} === ${time}`).rollup(formulas).objects()[0] as {
      [key: string]: number[]
    }
    return summaries
  }, [data, time])
  const summaryDisplay = useMemo(() => {
    if (view.profile) {
      const values = data
        .filter(`d.${info.refs.entity} === ${view.profile} & d.${info.refs.time} === ${time}`)
        .select(Object.keys(summaries))
        .objects()[0] as {[key: string]: number}
      if (!values) return
      const sections: {[key: string]: {id: string; label: string}} = {}
      const section: {[key: string]: ReactElement} = {}
      Object.keys(summaries).forEach(id => {
        const v = variables[id]
        sections[v.section] = {id: v.section, label: v.labels.section}
        if (view.profile_section === v.section) {
          if (v.category) {
            if (!(v.labels.category in section)) {
              const category = categories[v.category_id]
              section[v.category_id] = (
                <Card key={v.id} sx={{p: 0}}>
                  <CardHeader title={<Typography variant="h6">{v.labels.variable}</Typography>} />
                  <CardContent sx={{p: 0, pb: '0px !important'}}>
                    <Table size="small">
                      <TableBody>
                        {category.categories.map(cat => (
                          <SummaryRow
                            value={values[cat.id]}
                            key={cat.id}
                            label={cat.labels.category}
                            summary={summaries[cat.id]}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )
            }
          } else {
            section[v.id] = (
              <Card key={v.id} sx={{p: 0}}>
                <CardHeader title={<Typography variant="h6">{v.labels.variable}</Typography>} />
                <CardContent sx={{p: 0, pb: '0px !important'}}>
                  <Table size="small">
                    <TableBody>
                      <SummaryRow value={values[v.id]} summary={summaries[v.id]} />
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          }
        }
      })
      return {sections, section}
    }
  }, [summaries, view.profile, view.profile_section])
  const setProfile = (entity: string) => viewAction({key: 'profile', value: entity})
  const clearProfile = () => setProfile('')
  return (
    <>
      <Button variant="text" color="inherit" onClick={() => setProfile(allEntities[0].key)}>
        Profile
      </Button>
      <Dialog open={!!view.profile} onClose={clearProfile} fullScreen>
        <DialogTitle>District Profile</DialogTitle>
        <IconButton
          aria-label="close import menu"
          onClick={clearProfile}
          sx={{
            position: 'absolute',
            right: 8,
            top: 12,
          }}
          className="close-button"
        >
          <Close />
        </IconButton>
        <DialogContent sx={{p: 1, overflow: 'hidden'}}>
          <Stack spacing={1} direction="row">
            <Autocomplete
              size="small"
              fullWidth
              options={allEntities}
              filterOptions={filterOptions}
              value={entityOptions[view.profile || allEntities[0].key]}
              onChange={(_, selection) => setProfile(selection.key)}
              disableClearable
              getOptionLabel={option => option.name}
              renderInput={params => <TextField {...params} label="District / Town" />}
            />
            <TextField
              value={time}
              size="small"
              type="number"
              label="Year"
              onChange={e =>
                viewAction({
                  key: 'select_time',
                  value: '' + Math.max(info.time_range.min, Math.min(info.time_range.max, +e.target.value)),
                })
              }
            ></TextField>
          </Stack>
          {summaryDisplay && (
            <>
              <Autocomplete
                size="small"
                fullWidth
                options={Object.values(summaryDisplay.sections)}
                value={summaryDisplay.sections[view.profile_section]}
                onChange={(_, selection) => viewAction({key: 'profile_section', value: selection.id})}
                disableClearable
                renderInput={params => <TextField {...params} label="Variable Section" />}
                sx={{pt: 2}}
              />
              <Stack spacing={1} sx={{mt: 1, height: 'calc(100% - 100px)', overflowY: 'auto'}}>
                <Stack spacing={1} sx={{p: 1}}>
                  {Object.values(summaryDisplay.section)}
                </Stack>
              </Stack>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
