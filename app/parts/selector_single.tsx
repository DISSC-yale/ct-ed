import {Autocomplete, TextField} from '@mui/material'
import type {VariableInfo} from '../data/load'

export function SingleSelect({
  label,
  options,
  selection,
  update,
  clearable,
}: {
  label: string
  options: VariableInfo[]
  selection: VariableInfo
  update: (selection: VariableInfo) => void
  clearable?: boolean
}) {
  return (
    <Autocomplete
      size="small"
      fullWidth
      options={options}
      value={selection}
      onChange={(_, value) => update(value || ({id: '', labels: {category: ''}} as unknown as VariableInfo))}
      disableClearable={!clearable}
      getOptionLabel={option => option.labels.category}
      renderInput={params => <TextField {...params} label={label} />}
    />
  )
}
