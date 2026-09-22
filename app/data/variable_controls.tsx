import {
  Autocomplete,
  Button,
  Card,
  CardContent,
  CardHeader,
  createFilterOptions,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import {Category, Variable, type Categories, type VariableInfo} from './variable'
import {useContext, useMemo} from 'react'
import {ViewActionContext, type ViewAction} from './view'
import {DataContext, type Resources} from './load'
import {Selector} from '../parts/selector'
import {SingleSelect, type SelectOption} from '../parts/selector_single'
import {BasicSelector} from '../parts/selector_basic'

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
  isAdditional,
  name,
  variable,
  update,
  options,
  allVariables,
  variables,
  categories,
}: {
  isAdditional: boolean
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
        variable.multi && !isAdditional ?
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
      {variable.category.levels.length && !isAdditional ?
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
        <FormControlLabel
          label="Inflation Adjust"
          labelPlacement="end"
          control={
            <Switch
              size="small"
              checked={variable.deflate}
              onChange={() => update({key: 'variable', which: name, part: 'deflate', value: !variable.deflate})}
            />
          }
        />
      : <></>}
      {!isAdditional && variable.additional && (
        <Button
          size="small"
          onClick={() =>
            update({
              key: 'variable',
              which: name,
              part: 'additional.remove',
              value: true,
            })
          }
        >
          Remove Adjuster
        </Button>
      )}
      {!isAdditional &&
        (variable.additional ?
          <Stack spacing={1} sx={{p: 2, pt: 0}}>
            <FormControl variant="outlined" fullWidth size="small">
              <InputLabel id="operator_select">Adjustment</InputLabel>
              <Select
                labelId="operator_select"
                label="Adjustment"
                value={variable.additional.operator}
                onChange={e => {
                  update({key: 'variable', which: name, part: 'additional.operator', value: e.target.value})
                }}
              >
                {operatorOptions}
              </Select>
            </FormControl>
            <Typography variant="caption">{variable.additional.variable.category.labels.section}</Typography>
            <FieldControls
              isAdditional={true}
              name={name}
              variable={variable.additional.variable}
              update={action => update({key: 'variable', which: name, part: 'additional.action', action})}
              options={options}
              allVariables={allVariables}
              categories={categories}
              variables={variables}
            />
          </Stack>
        : <Button
            size="small"
            onClick={() =>
              update({
                key: 'variable',
                which: name,
                part: 'additional',
                value: {operator: 'none', variable: new Variable(variable.id, categories)},
              })
            }
          >
            Add Adjuster
          </Button>)}
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
          isAdditional={false}
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
