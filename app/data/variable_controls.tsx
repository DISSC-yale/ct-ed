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
import {Category, Variable} from './variable'
import {useContext} from 'react'
import {ViewActionContext} from './view'
import {DataContext, type Resources} from './load'
import {Selector} from '../parts/selector'
import {SingleSelect} from '../parts/selector_single'

const filterOptions = createFilterOptions({stringify: (option: Category) => option.searchString})

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
  const {categories} = useContext(DataContext) as Resources
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
      <CardContent sx={{p: 1}}>
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
          {variable.category && variable.category.categories.length > 1 ?
            variable.multi ?
              <Selector
                label="Levels"
                options={variable.category.categories}
                selection={variable.selection}
                update={value => viewAction({key: 'variable', which: name, part: 'selection', value})}
              />
            : <SingleSelect
                label="Level"
                options={variable.category.categories}
                selection={variable.selection[0]}
                update={value => viewAction({key: 'variable', which: name, part: 'selection', value: [value]})}
              />

          : <></>}
          {variable.firstType === 'dollar' ?
            <FormControlLabel
              label="Adjust for Inflation"
              labelPlacement="start"
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
