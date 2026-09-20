import {
  Autocomplete,
  Card,
  CardContent,
  CardHeader,
  createFilterOptions,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import {Category, Variable, type VariableInfo} from './variable'
import {useContext, useMemo} from 'react'
import {ViewActionContext} from './view'
import {DataContext, type Resources} from './load'
import {Selector} from '../parts/selector'
import {SingleSelect, type SelectOption} from '../parts/selector_single'
import {BasicSelector} from '../parts/selector_basic'

const filterOptions = createFilterOptions({stringify: (option: Category) => option.searchString})

function infoToOption(info: VariableInfo): SelectOption {
  return {key: info.id, label: info.labels.category}
}

const aggOptions = ['none', 'sum', 'mean', 'median']

export default function VariableControls({
  name,
  variable,
  allVariables,
}: {
  name: 'x' | 'y'
  variable: Variable
  allVariables: Category[]
}) {
  const viewAction = useContext(ViewActionContext)
  const {categories, variables} = useContext(DataContext) as Resources
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
        sx={{p: 1, '& .MuiCardHeader-content': {maxWidth: '100%', width: '100%'}}}
        title={
          <Typography sx={{textOverflow: 'ellipsis', overflow: 'hidden'}}>
            {variable.category.labels.section}
          </Typography>
        }
      />
      <CardContent sx={{p: 1, pb: '8px !important'}}>
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
                viewAction({key: name, value: new Variable(selection.key, categories)})
              }
            }}
          ></Autocomplete>
          {variable.category && variable.category.levels.length ?
            variable.multi ?
              <>
                <Selector
                  label="Levels"
                  options={Object.values(options)}
                  selection={variable.selection.map(({id}) => options[id])}
                  update={value => {
                    viewAction({
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
                    update={(option: string) => viewAction({key: 'variable', which: name, part: 'agg', value: option})}
                  />
                : <></>}
              </>
            : <SingleSelect
                label="Level"
                options={Object.values(variable.category.variables).map(infoToOption)}
                selection={infoToOption(variable.selection[0])}
                update={value =>
                  viewAction({
                    key: 'variable',
                    which: name,
                    part: 'selection',
                    value: [variable.category.variables[(value as SelectOption).key]],
                  })
                }
              />

          : <></>}
          {variable.category.levels.length ?
            <FormControlLabel
              label="Multiple Levels"
              labelPlacement="end"
              control={
                <Switch
                  size="small"
                  checked={variable.multi}
                  onChange={() => viewAction({key: 'variable', which: name, part: 'multi', value: !variable.multi})}
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
                  onChange={() => viewAction({key: 'variable', which: name, part: 'deflate', value: !variable.deflate})}
                />
              }
            />
          : <></>}
        </Stack>
      </CardContent>
    </Card>
  )
}
