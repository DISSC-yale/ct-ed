import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  createFilterOptions,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {Category, Variable, type Categories, type VariableInfo} from './variable'
import {useContext, useMemo} from 'react'
import {ViewActionContext, type ViewAction} from './view'
import {DataContext, type Resources} from './load'
import {Selector} from '../parts/selector'
import {SingleSelect, type SelectOption} from '../parts/selector_single'
import {BasicSelector} from '../parts/selector_basic'
import {Close, ExpandMore} from '@mui/icons-material'

const filterOptions = createFilterOptions({stringify: (option: Category) => option.searchString})

function infoToOption(info: VariableInfo): SelectOption {
  return {key: info.id, label: info.labels.category}
}

const aggOptions = ['none', 'sum', 'mean', 'median']

const operatorOptions = [
  <MenuItem key="none" value="none">
    None
  </MenuItem>,
  <MenuItem key="-" value="-">
    Subtract
  </MenuItem>,
  <MenuItem key="*" value="*">
    Multiply
  </MenuItem>,
  <MenuItem key="/" value="/">
    Divide
  </MenuItem>,
]

function FieldControls({
  isAdjuster,
  isAdditional,
  name,
  variable,
  update,
  options,
  allVariables,
  variables,
  categories,
}: {
  isAdjuster?: boolean
  isAdditional?: boolean
  name: 'x' | 'y'
  variable: Variable
  update: (action: ViewAction) => void
  options: {[key: string]: SelectOption}
  allVariables: Category[]
  variables: {[key: string]: VariableInfo}
  categories: Categories
}) {
  return (
    <Stack spacing={1}>
      <Autocomplete
        options={allVariables}
        sx={{'& li': {p: 0}}}
        getOptionLabel={option => option.labels.variable}
        groupBy={option => option.labels.section}
        renderInput={params => <TextField {...params} label="Variable" />}
        filterOptions={filterOptions}
        value={categories[variable.id]}
        fullWidth
        size="small"
        disableClearable
        onChange={(_, selection) => {
          if (selection) {
            update({key: name, value: new Variable(selection.key, categories)})
          }
        }}
      ></Autocomplete>
      {variable.category && variable.category.levels.length ?
        variable.multi && !isAdjuster ?
          <>
            <Selector
              label="Levels"
              options={Object.values(options)}
              selection={variable.selection.map(({id}) => options[id])}
              update={value => {
                update({
                  key: 'variable',
                  which: name,
                  part: 'selection',
                  value: value.map(({key}) => variables[key]),
                })
              }}
            />
            {variable.selection.length > 1 ?
              <BasicSelector
                label="Level Aggregation"
                options={aggOptions}
                selection={(variable.agg || 'none') as unknown as string}
                update={(option: string) => update({key: 'variable', which: name, part: 'agg', value: option})}
              />
            : <></>}
          </>
        : <SingleSelect
            label="Level"
            options={Object.values(variable.category.variables).map(infoToOption)}
            selection={infoToOption(variable.selection[0])}
            update={value =>
              update({
                key: 'variable',
                which: name,
                part: 'selection',
                value: [variable.category.variables[(value as SelectOption).key]],
              })
            }
          />

      : <></>}
      <Stack direction="row" spacing={1} sx={{pl: 1, justifyContent: 'space-between'}}>
        <Box>
          {variable.category.levels.length && !isAdjuster ?
            <FormControlLabel
              label="Multiple Levels"
              labelPlacement="end"
              control={
                <Switch
                  size="small"
                  checked={variable.multi}
                  onChange={() => update({key: 'variable', which: name, part: 'multi', value: !variable.multi})}
                />
              }
            />
          : <></>}
          {variable.firstType === 'dollar' ?
            <Tooltip title="Adjust for inflation." placement="left">
              <FormControlLabel
                label="Deflate"
                labelPlacement="end"
                control={
                  <Switch
                    size="small"
                    checked={variable.deflate}
                    onChange={() => update({key: 'variable', which: name, part: 'deflate', value: !variable.deflate})}
                  />
                }
              />
            </Tooltip>
          : <></>}
          {!isAdjuster && !isAdditional && variable.additional.length ?
            <Tooltip title="Scale (z-score) all variables independently." placement="left">
              <FormControlLabel
                label="Scale"
                labelPlacement="end"
                control={
                  <Switch
                    size="small"
                    checked={variable.scale}
                    onChange={() => update({key: 'variable', which: name, part: 'scale', value: !variable.scale})}
                  />
                }
              />
            </Tooltip>
          : <></>}
        </Box>
        {!isAdjuster ?
          variable.adjuster ?
            <Button
              size="small"
              onClick={() =>
                update({
                  key: 'variable',
                  which: name,
                  part: 'adjuster.remove',
                  value: true,
                })
              }
            >
              Unadjust
            </Button>
          : <Tooltip title="Add a variable to adjust this variable by." placement="bottom">
              <Button
                size="small"
                onClick={() =>
                  update({
                    key: 'variable',
                    which: name,
                    part: 'adjuster',
                    value: {operator: 'none', variable: new Variable(variable.id, categories)},
                  })
                }
              >
                Adjust
              </Button>
            </Tooltip>

        : <></>}
      </Stack>
      {!isAdjuster && variable.adjuster && (
        <Stack spacing={1} sx={{p: 2, pt: 0, pb: 0}}>
          <FormControl variant="outlined" fullWidth size="small">
            <InputLabel id="operator_select">Adjustment</InputLabel>
            <Select
              labelId="operator_select"
              label="Adjustment"
              value={variable.adjuster.operator}
              onChange={e => {
                update({key: 'variable', which: name, part: 'adjuster.operator', value: e.target.value})
              }}
            >
              {operatorOptions}
            </Select>
          </FormControl>
          <Typography variant="caption">{variable.adjuster.variable.category.labels.section}</Typography>
          <FieldControls
            isAdjuster={true}
            name={name}
            variable={variable.adjuster.variable}
            update={action => update({key: 'variable', which: name, part: 'adjuster.action', action})}
            options={options}
            allVariables={allVariables}
            categories={categories}
            variables={variables}
          />
        </Stack>
      )}
      {!isAdjuster && !isAdditional && (
        <Button
          size="small"
          onClick={() =>
            update({
              key: 'variable',
              which: name,
              part: 'additional',
              value: new Variable(variable.id, categories),
            })
          }
        >
          Add Variable
        </Button>
      )}
      {!isAdjuster && !isAdditional && variable.additional.length ?
        <Accordion variant="outlined" defaultExpanded={true}>
          <AccordionSummary
            expandIcon={<ExpandMore />}
            aria-controls={`${name}-additional-variables`}
            id={`${name}-additional-variables`}
          >
            <Typography>Additional Variables</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{p: 0.5}}>
            <Stack spacing={0.5}>
              {variable.additional.map((v, index) => (
                <Paper key={index} variant="outlined" sx={{position: 'relative'}}>
                  <IconButton
                    aria-label="remove additional variable"
                    onClick={() => update({key: 'variable', which: name, part: 'additional.remove', value: index})}
                    color="error"
                    sx={{
                      position: 'absolute',
                      right: -5,
                      top: -5,
                    }}
                  >
                    <Close />
                  </IconButton>
                  <Stack spacing={1} sx={{p: 0.5}}>
                    <Typography variant="caption">{v.category.labels.section}</Typography>
                    <FieldControls
                      isAdjuster={true}
                      isAdditional={true}
                      name={name}
                      variable={v}
                      update={action =>
                        update({key: 'variable', which: name, part: 'additional.action', index, action})
                      }
                      options={options}
                      allVariables={allVariables}
                      categories={categories}
                      variables={variables}
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      : <></>}
    </Stack>
  )
}

export default function VariableControls({
  name,
  variable,
  allVariables,
  categories,
}: {
  name: 'x' | 'y'
  variable: Variable
  allVariables: Category[]
  categories: Categories
}) {
  const viewAction = useContext(ViewActionContext)
  const {variables} = useContext(DataContext) as Resources
  const options = useMemo(() => {
    const o: {[key: string]: SelectOption} = {}
    Object.values(variable.category.variables).forEach(v => {
      o[v.id] = infoToOption(v)
    })
    return o
  }, [variable.category.variables])
  return (
    <Card variant="outlined">
      <CardHeader
        sx={{p: 0.5, pl: 1, '& .MuiCardHeader-content': {maxWidth: '100%', width: '100%'}}}
        title={
          <Typography sx={{textOverflow: 'ellipsis', overflow: 'hidden'}}>
            {variable.category.labels.section}
          </Typography>
        }
      />
      <CardContent sx={{p: 1, pb: '8px !important'}}>
        <FieldControls
          name={name}
          variable={variable}
          update={viewAction}
          options={options}
          allVariables={allVariables}
          categories={categories}
          variables={variables}
        />
      </CardContent>
    </Card>
  )
}
