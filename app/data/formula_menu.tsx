import {useContext, useMemo, type ChangeEvent, type ReactElement} from 'react'
import {Box, Stack, TextField, Tooltip, Typography} from '@mui/material'
import {FormulaContext, FormulaEditor} from './view'
import type {Formula, FormulaParam} from './formula'
import {background} from './load'

function makeInput(
  name: string,
  spec: FormulaParam,
  value: number,
  onChange: (e: ChangeEvent<HTMLInputElement>) => void,
) {
  return (
    <Box key={name}>
      <Tooltip placement="left" title={spec.label}>
        <TextField value={value} size="small" type="number" label={name} onChange={onChange} fullWidth></TextField>
      </Tooltip>
    </Box>
  )
}

export default function FormulaMenu() {
  const formula = background.formula as Formula
  const formulaParams = useContext(FormulaContext)
  const editFormula = useContext(FormulaEditor)
  const params = formula.param_specs
  const controls = useMemo(() => {
    const categories: {[key: string]: ReactElement[]} = {}
    Object.keys(params).forEach(name => {
      const paramSpec = params[name]
      if (!(paramSpec.category in categories)) categories[paramSpec.category] = []
      if (Array.isArray(paramSpec.value)) {
      } else {
        const control = makeInput(name, paramSpec, formulaParams[name] as number, e =>
          editFormula({key: 'param', which: name, value: +e.target.value}),
        )
        categories[paramSpec.category].push(control)
      }
    })
    return categories
  }, [formulaParams, editFormula])
  const colStyle = {overflow: 'auto', pt: 1, minWidth: 150}
  return (
    <Stack spacing={2} direction="row" sx={{height: '100%'}}>
      <Stack>
        <Typography>Primary Weights</Typography>
        <Stack spacing={1} sx={colStyle}>
          {controls['Primary Weight']}
        </Stack>
      </Stack>
      <Stack>
        <Typography>Primary Funding</Typography>
        <Stack spacing={1} sx={colStyle}>
          {controls['Primary Funding']}
        </Stack>
      </Stack>
      <Stack>
        <Typography>Secondary</Typography>
        <Stack spacing={1} sx={colStyle}>
          {controls.Secondary}
        </Stack>
      </Stack>
      <Stack>
        <Typography>Poverty</Typography>
        <Stack spacing={1} sx={colStyle}>
          {controls.Poverty}
        </Stack>
      </Stack>
      <Stack>
        <Typography>Precision</Typography>
        <Stack spacing={1} sx={colStyle}>
          {controls.Precision}
        </Stack>
      </Stack>
    </Stack>
  )
}
