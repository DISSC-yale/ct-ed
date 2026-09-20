import {Autocomplete, Button, Checkbox, Stack, TextField, Typography} from '@mui/material'
import type {SelectOption} from './selector_single'

export function Selector({
  label,
  options,
  selection,
  update,
}: {
  label: string
  options: SelectOption[]
  selection: SelectOption[]
  update: (selection: SelectOption[]) => void
}) {
  return (
    <Stack direction="row">
      <Autocomplete
        options={options}
        sx={{'& li': {p: 0}}}
        renderOption={(props, option, {selected}) => {
          const {key, ...optionProps} = props
          return (
            <li key={key} {...optionProps}>
              <Checkbox checked={selected} />
              {option.label}
            </li>
          )
        }}
        getOptionLabel={option => option.key}
        renderInput={params => <TextField {...params} label={label} />}
        value={selection}
        renderValue={() => (
          <Typography sx={{p: 1, pt: 0, pb: 0}}>
            {selection.length === 1 ? selection[0].label : `${selection.length} / ${options.length}`}
          </Typography>
        )}
        multiple
        disableCloseOnSelect
        fullWidth
        size="small"
        onChange={(_, newSelection) => update([...newSelection])}
      ></Autocomplete>
      <Button variant="contained" onClick={() => update([...options])}>
        All
      </Button>
    </Stack>
  )
}
