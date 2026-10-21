import {Table, TableBody, TableCell, TableRow, Tooltip, Typography} from '@mui/material'
import {useContext, useMemo} from 'react'
import {FullDataContext} from '../data/view'
import {formatValue} from '../utils'

export default function SummaryTable() {
  const data = useContext(FullDataContext)
  const latestTotals = useMemo(() => {
    if (data.numRows()) {
      const totals = data
        .filter('d.general__fiscal_year === max(d.general__fiscal_year)')
        .rollup({
          year: 'max(d.general__fiscal_year)',
          full_grant: 'round(sum(d.ecs__fully_funded_grant))',
          entitlement: 'round(sum(d.ecs__entitlement))',
          computed_full_grant: 'round(sum(d.computed__fully_funded_grant))',
          computed_entitlement: 'round(sum(d.computed__entitlement))',
        })
        .object(0) as {[key: string]: number}
      totals.full_grant_diff = totals.computed_full_grant - totals.full_grant
      totals.entitlement_diff = totals.computed_entitlement - totals.entitlement
      return totals
    }
  }, [data])
  return (
    latestTotals && (
      <Table size="small" padding="none" sx={{whiteSpace: 'nowrap', width: 200, opacity: 0.75}}>
        <TableBody>
          <TableRow>
            <TableCell component="th" scope="row" sx={{pr: 3}}>
              {latestTotals.year} Full Grant
            </TableCell>
            <TableCell>
              {formatValue(latestTotals.computed_full_grant)} (
              <Tooltip
                placement="top"
                title="Official ECS fully funded grant subtracted from the version computed here."
              >
                <Typography variant="caption" color={latestTotals.full_grant_diff < 0 ? 'error' : 'success'}>
                  {formatValue(latestTotals.full_grant_diff)}
                </Typography>
              </Tooltip>
              )
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell component="th" scope="row">
              {latestTotals.year} Entitlement
            </TableCell>
            <TableCell>
              {formatValue(latestTotals.computed_entitlement)} (
              <Tooltip title="Official ECS entitlement with alliance harm held subtracted from the version computed here.">
                <Typography variant="caption" color={latestTotals.entitlement_diff < 0 ? 'error' : 'success'}>
                  {formatValue(latestTotals.entitlement_diff)}
                </Typography>
              </Tooltip>
              )
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
  )
}
