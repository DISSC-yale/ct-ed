import {Autocomplete, TextField} from '@mui/material'
export type SelectOption = {key: string; label: string}

export function SingleSelect({
  label,
  options,
  selection,
  update,
  clearable,
}: {
  label: string
  options: SelectOption[]
  selection: SelectOption
  update: (selection: SelectOption | null) => void
  clearable?: boolean
}) {
  return (
    <Autocomplete
      size="small"
      fullWidth
      options={options}
      value={selection}
      onChange={(_, value) => update(value)}
      disableClearable={!clearable}
      renderInput={params => <TextField {...params} label={label} />}
    />
  )
}
