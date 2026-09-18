import {Autocomplete, Button, Checkbox, createFilterOptions, Stack, TextField, Typography} from '@mui/material'
import {useCallback, useContext, useMemo} from 'react'
import {DataContext, type Resources} from '../data/load'
import {ViewActionContext, ViewContext, type ViewDef} from '../data/view'

export type EntityOption = {key: string; searchString: string; name: string}
export const filterOptions = createFilterOptions({stringify: (option: EntityOption) => option.searchString})
export const entityOptions: {[index: string]: EntityOption} = {}

export function FilterEntities() {
  const view = useContext(ViewContext) as ViewDef
  const viewAction = useContext(ViewActionContext)
  const {info, selectEntities} = useContext(DataContext) as Resources
  const makeEntityOption = useCallback(
    (id: string) => {
      if (!(id in entityOptions)) {
        const entity = info.entities[id]
        entityOptions[id] = {key: id, searchString: JSON.stringify(entity), name: entity.name}
      }
      return entityOptions[id]
    },
    [info.entities],
  )
  const allEntities: EntityOption[] = useMemo(
    () => Object.keys(info.entities).map(makeEntityOption),
    [!!info.entities, makeEntityOption],
  )
  const filteredEntities = useMemo(
    () => Object.keys(view.entities_select).map(makeEntityOption),
    [view.entities_select, makeEntityOption],
  )
  return (
    <Stack direction="row">
      <Autocomplete
        options={allEntities}
        sx={{'& li': {p: 0}}}
        renderOption={(props, option, {selected}) => {
          const {key, ...optionProps} = props
          return (
            <li key={key} {...optionProps} style={{paddingTop: 0, paddingBottom: 0}}>
              <Checkbox checked={selected} size="small" />
              <Typography sx={{fontSize: 'small'}}>{`${option.name} (${option.key})`}</Typography>
            </li>
          )
        }}
        getOptionLabel={option => option.key}
        renderInput={params => <TextField {...params} label="Districts / Towns" />}
        filterOptions={filterOptions}
        value={filteredEntities}
        renderValue={() => (
          <Typography sx={{p: 1, pt: 0, pb: 0, whiteSpace: 'nowrap'}}>
            {filteredEntities.length} / {allEntities.length}
          </Typography>
        )}
        multiple
        disableCloseOnSelect
        fullWidth
        size="small"
        onChange={(_, selection) => {
          const value: {[index: string]: boolean} = {}
          selection.forEach(country => (value[country.key] = true))
          viewAction({key: 'entities', value})
        }}
      ></Autocomplete>
      <Button
        size="small"
        variant="contained"
        onClick={() => viewAction({key: 'entities', value: selectEntities})}
        aria-label="select all countries"
      >
        All
      </Button>
    </Stack>
  )
}
