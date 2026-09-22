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
import {FullDataContext, ViewActionContext, ViewContext, type ViewDef} from '../data/view'
import {formatValue} from '../utils'
import type {VariableInfo} from '../data/variable'

function numberSummary(v: string) {
  return `[min(d.${v}), quantile(d.${v}, .25), median(d.${v}), mean(d.${v}), quantile(d.${v}, .75), max(d.${v})]`
}
const color = {
  base: '#9c9c9c',
  quartile: '#2f65a7',
  mean: '#ececec',
  median: '#b6b6b6',
  current: '#b13030',
}

function SummaryBar({value, summary, info}: {value: number; summary: number[]; info: VariableInfo}) {
  const absMin = Math.abs(summary[0])
  const s = summary.map(v => v + absMin)
  const min = s[0]
  const denom = s[5] - min
  return (
    <Stack
      sx={{
        position: 'relative',
        width: '100%',
        height: 35,
        justifyContent: 'space-between',
        alignItems: 'center',
        '& .MuiBox-root': {transition: 'right 700ms, left 700ms'},
      }}
      spacing={1}
      direction="row"
    >
      <Box
        sx={{
          opacity: 0.75,
          width: 100,
          textAlign: 'right',
        }}
      >
        {formatValue(summary[0], info)}
      </Box>
      <Box sx={{backgroundColor: color.base, height: 10, position: 'relative', width: '100%'}}>
        <Box
          sx={{
            position: 'absolute',
            backgroundColor: color.quartile,
            height: 10,
            left: ((s[1] - min) / denom) * 100 + '%',
            right: (1 - (s[4] - min) / denom) * 100 + '%',
          }}
        ></Box>
        <Box
          sx={{
            position: 'absolute',
            height: 10,
            width: 2,
            backgroundColor: color.mean,
            left: ((s[3] - min) / denom) * 100 + '%',
          }}
        ></Box>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            height: 30,
            width: 2,
            backgroundColor: color.median,
            lineHeight: 2.8,
            opacity: 0.75,
            textIndent: 5,
            left: summary[2] == null ? '50%' : ((s[2] - min) / denom) * 100 + '%',
          }}
        >
          {formatValue(summary[2], info)}
        </Box>
        <Box
          sx={{
            position: 'absolute',
            height: 30,
            width: 2,
            backgroundColor: color.current,
            top: '-19px',
            textIndent: 5,
            left: value == null ? '50%' : ((value + absMin - min) / denom) * 100 + '%',
          }}
        >
          {formatValue(value, info)}
        </Box>
      </Box>
      <Box
        sx={{
          opacity: 0.75,
          width: 100,
        }}
      >
        {formatValue(summary[5], info)}
      </Box>
    </Stack>
  )
}
function SummaryRow({
  label,
  value,
  summary,
  info,
}: {
  label?: string
  value: number
  summary: number[]
  info: VariableInfo
}) {
  return label ?
      <TableRow>
        <TableCell component="th" scope="row" sx={{width: 270}}>
          {label}
        </TableCell>
        <TableCell>
          <SummaryBar value={value} summary={summary} info={info} />
        </TableCell>
      </TableRow>
    : <TableRow>
        <TableCell>
          <SummaryBar value={value} summary={summary} info={info} />
        </TableCell>
      </TableRow>
}

export function ProfileDisplay() {
  const {info, meta, variable_types, variables} = useContext(DataContext) as Resources
  const data = useContext(FullDataContext)
  const view = useContext(ViewContext) as ViewDef
  const viewAction = useContext(ViewActionContext)
  const time = view.select_time || '' + 2025
  const allEntities: EntityOption[] = useMemo(
    () =>
      Object.keys(meta.entities).map(id => {
        if (!(id in entityOptions)) {
          const entity = meta.entities[id]
          entityOptions[id] = {key: id, searchString: JSON.stringify(entity), name: entity.name}
        }
        return entityOptions[id]
      }),
    [meta.entities],
  )
  const summaries = useMemo(() => {
    const formulas: {[key: string]: string} = {}
    variable_types.dollar.forEach(({id}) => (formulas[id] = numberSummary(id)))
    variable_types.percent.forEach(({id}) => (formulas[id] = numberSummary(id)))
    variable_types.value.forEach(({id}) => (formulas[id] = numberSummary(id)))
    const summaries = data.ungroup().filter(`d.${info.refs.time} === ${time}`).rollup(formulas).objects()[0] as {
      [key: string]: number[]
    }
    return summaries
  }, [variable_types, data, time, info.refs.time])
  const summaryDisplay = useMemo(() => {
    if (view.profile) {
      const values = data
        .filter(`d.${info.refs.entity} === '${view.profile}' & d.${info.refs.time} === ${time}`)
        .select(Object.keys(summaries))
        .objects()[0] as {[key: string]: number}
      if (!values) return
      const sections: {[key: string]: {id: string; label: string}} = {}
      const section: {[key: string]: ReactElement} = {}
      Object.keys(values).forEach(id => {
        const {parts, labels, category} = variables[id]
        sections[parts.section] = {id: parts.section, label: labels.section}
        if (category && parts.section === view.profile_section) {
          if (parts.category) {
            const category_id = parts.section + parts.variable
            if (!(category_id in section)) {
              section[category_id] = (
                <Card key={id} sx={{p: 0}}>
                  <CardHeader title={<Typography variant="h6">{labels.variable}</Typography>} />
                  <CardContent sx={{p: 0, pb: '0px !important'}}>
                    <Table size="small">
                      <TableBody>
                        {Object.values(category.variables).map(cat => (
                          <SummaryRow
                            value={values[cat.id]}
                            key={cat.id}
                            label={cat.labels.category}
                            summary={summaries[cat.id]}
                            info={variables[id]}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )
            }
          } else {
            section[id] = (
              <Card key={id} sx={{p: 0}}>
                <CardHeader title={<Typography variant="h6">{labels.variable}</Typography>} />
                <CardContent sx={{p: 0, pb: '0px !important'}}>
                  <Table size="small">
                    <TableBody>
                      <SummaryRow value={values[id]} summary={summaries[id]} info={variables[id]} />
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
  }, [variables, summaries, view.profile, view.profile_section, data, info.refs.entity, info.refs.time, time])
  const setProfile = (entity: string) => viewAction({key: 'profile', value: entity})
  const clearProfile = () => setProfile('')
  return (
    <>
      <Button variant="text" color="inherit" onClick={() => setProfile(allEntities[0].key)}>
        Profile
      </Button>
      <Dialog
        open={!!view.profile}
        onClose={clearProfile}
        fullWidth
        maxWidth="lg"
        sx={{'& .MuiDialog-container': {alignItems: 'flex-start'}}}
      >
        <DialogTitle sx={{p: 1}}>District Profile</DialogTitle>
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
        <DialogContent sx={{p: 1, overflow: 'hidden', display: 'grid'}}>
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
                  value: e.target.value,
                })
              }
            ></TextField>
          </Stack>
          {summaryDisplay ?
            <>
              <Autocomplete
                size="small"
                fullWidth
                options={Object.values(summaryDisplay.sections)}
                value={summaryDisplay.sections[view.profile_section]}
                onChange={(_, selection) => viewAction({key: 'profile_section', value: selection.id})}
                disableClearable
                renderInput={params => <TextField {...params} label="Variable Section" />}
                sx={{pt: 3}}
              />
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{border: 'none'}}>
                      <Stack
                        sx={{
                          position: 'relative',
                          width: '100%',
                          height: 30,
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          '& .MuiBox-root': {transition: 'right 700ms, left 700ms', transitionDelay: '200ms'},
                        }}
                        spacing={1}
                        direction="row"
                      >
                        <Box
                          sx={{
                            opacity: 0.75,
                            width: 100,
                            textAlign: 'right',
                          }}
                        >
                          Min
                        </Box>
                        <Box sx={{backgroundColor: color.base, height: 10, position: 'relative', width: '100%'}}>
                          <Box
                            sx={{
                              position: 'absolute',
                              backgroundColor: color.quartile,
                              height: 10,
                              left: '25%',
                              right: '25%',
                            }}
                          ></Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              height: 10,
                              left: '23%',
                              lineHeight: 2.8,
                              opacity: 0.75,
                              textIndent: 5,
                            }}
                          >
                            25%
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              height: 10,
                              width: 2,
                              backgroundColor: color.mean,
                              left: '60%',
                              lineHeight: 2.8,
                              opacity: 0.75,
                              textIndent: 5,
                            }}
                          >
                            Mean
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              height: 10,
                              width: 2,
                              left: '73%',
                              lineHeight: 2.8,
                              opacity: 0.75,
                              textIndent: 5,
                            }}
                          >
                            75%
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 0,
                              height: 25,
                              width: 2,
                              backgroundColor: color.median,
                              lineHeight: 2.8,
                              opacity: 0.75,
                              textIndent: 5,
                              left: '40%',
                            }}
                          >
                            Median
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              height: 28,
                              width: 2,
                              backgroundColor: color.current,
                              top: '-17px',
                              textIndent: 5,
                              left: '50%',
                            }}
                          >
                            District
                          </Box>
                        </Box>
                        <Box
                          sx={{
                            opacity: 0.8,
                            width: 100,
                          }}
                        >
                          Max
                        </Box>
                      </Stack>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Stack spacing={1} sx={{overflowY: 'auto', mb: 1}}>
                <Stack spacing={1}>{Object.values(summaryDisplay.section)}</Stack>
              </Stack>
            </>
          : <Box sx={{p: 5, textAlign: 'center'}}>
              <Typography>No data available.</Typography>
            </Box>
          }
        </DialogContent>
      </Dialog>
    </>
  )
}
