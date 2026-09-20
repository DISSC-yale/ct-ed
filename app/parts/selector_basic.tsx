import {FormControl, InputLabel, MenuItem, Select} from '@mui/material'
import {useMemo} from 'react'

export function BasicSelector({
  label,
  options,
  selection,
  update,
}: {
  label: string
  options: string[]
  selection: string
  update: (selection: string) => void
}) {
  const optionItems = useMemo(
    () =>
      options.map(option => (
        <MenuItem key={option} value={option}>
          {option}
        </MenuItem>
      )),
    [options],
  )
  return (
    <FormControl variant="outlined" fullWidth size="small">
      <InputLabel id={`${label}_select`}>{label}</InputLabel>
      <Select labelId={`${label}_select`} label={label} value={selection} onChange={e => update(e.target.value)}>
        {optionItems}
      </Select>
    </FormControl>
  )
}
