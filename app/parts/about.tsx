import {Close} from '@mui/icons-material'
import {Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography} from '@mui/material'
import {useContext} from 'react'
import {DataContext, Resources} from '../data/load'
import Link from 'next/link'

export function About({open, setOpen}: {open: boolean; setOpen: (open: boolean) => void}) {
  const {meta} = useContext(DataContext) as Resources
  const close = () => setOpen(!open)
  return (
    <>
      {open && (
        <Dialog open={open} onClose={close}>
          <DialogTitle sx={{pt: 1, pb: 1}}>About</DialogTitle>
          <IconButton
            aria-label="close export menu"
            onClick={close}
            sx={{
              position: 'absolute',
              right: 4,
              top: 4,
            }}
          >
            <Close />
          </IconButton>
          <DialogContent sx={{maxWidth: '100%', pt: 1}}>
            <Stack spacing={1}>
              <Typography>
                This site was made by the{' '}
                <Link href="https://dissc.yale.edu/" rel="noreferrer" target="_blank">
                  Yale Data-Intensive Social Science Center
                </Link>
                . View its source code at{' '}
                <Link href="https://github.com/DISSC-yale/ct-ed" rel="noreferrer" target="_blank">
                  github.com/DISSC-yale/ct-ed
                </Link>
                .
              </Typography>
              <Typography>
                It uses data from{' '}
                <Link href="https://public-edsight.ct.gov/" rel="noreferrer" target="_blank">
                  EdSight
                </Link>
                {' and '}
                <Link
                  href="https://portal.ct.gov/sde/services/k-12-education/finance/fiscal-services/education-cost-sharing-ecs"
                  rel="noreferrer"
                  target="_blank"
                >
                  Education Cost Sharing
                </Link>
                {' (ECS) spreadsheets (in '}
                <Link
                  href="https://github.com/DISSC-yale/ct-ed/tree/main/data/ecs_shells"
                  rel="noreferrer"
                  target="_blank"
                >
                  data/ecs_shells
                </Link>
                {') provided by the '}
                <Link href="https://portal.ct.gov/sde" rel="noreferrer" target="_blank">
                  Connecticut State Department of Education
                </Link>
                .
              </Typography>
              <Typography>Data updated {meta.updated}.</Typography>
              <Typography variant="h5">Usage Tips</Typography>
              <ul>
                <li>Clicking a district&apos;s name in the legend will select that district only.</li>
                <li>Clicking a point in the plot will open the district profile if lines are districts.</li>
                <li>
                  When the &quot;Advanced&quot; toggle is off, some variables are hidden from the variable selection
                  lists.
                </li>
                <li>
                  Data menu option and formula parameter changes are recorded in the URL, so if you want to share your
                  current view, send the whole URL. If you want to share the default view, remove all parameters
                  (everything after the <code>?</code>).
                </li>
              </ul>
              <Typography variant="h5">ECS Formula</Typography>
              <Typography>
                The ECS formula was recreated here from the spreadsheets, which almost exactly lines up, with two
                exceptions:
              </Typography>
              <ol>
                <li>
                  <Typography>
                    There is one small differences in 2018 due to a rounding error in Excel, in cell Z107 of{' '}
                    <Link
                      href="https://github.com/DISSC-yale/ct-ed/blob/main/data/ecs_shells/ECS%20Shell%202017-18%20Final%20Version.xls"
                      rel="noreferrer"
                      target="_blank"
                    >
                      ECS Shell 2017-18 Final Version.xls
                    </Link>
                    . You can see that in{' '}
                    <Link
                      href="?y=iFcomputed__entitlement-siFecs__entitlement&calculated_prior_after=2028"
                      rel="noreferrer"
                      target="_blank"
                    >
                      this view
                    </Link>
                    .
                  </Typography>
                </li>
                <li>
                  <Typography>
                    The Harm Held aspects of the formula use the prior year&apos;s entitlement to adjust the fully
                    funded grant for the final entitlement. The sheets include a version of the prior year&apos;s
                    entitlement, but this can sometimes differ from the entitlement arrived at in the prior year&apos;s
                    sheet. The <code>calculated_prior_after</code> parameter controls whether to use the actual prior
                    year&apos;s entitlement, or that included in the current sheet. If the included prior year numbers
                    are always used, the computed entitlements match the sheets exactly, but more differences show up as
                    earlier computed entitlements are fed forward. By default, computed prior-year entitlements are used
                    after 2022, since those differences are relatively small. You can see those difference in{' '}
                    <Link href="?y=iFcomputed__entitlement-siFecs__entitlement" rel="noreferrer" target="_blank">
                      this view
                    </Link>
                    .
                  </Typography>
                </li>
              </ol>
              <Typography>
                One aspect of getting the formula to line up is recording parameter and computation step differences
                between sheets. You can see those along with the current parameter values and steps in the{' '}
                <Link
                  href="https://github.com/DISSC-yale/ct-ed/blob/main/metadata.json"
                  rel="noreferrer"
                  target="_blank"
                >
                  metadata.json
                </Link>{' '}
                file.
              </Typography>
              <Typography>
                To accommodate parameter adjustments that can affect prior years, parameter differences are applied as
                offsets from the current value. For example, the current <code>ell</code> parameter value is{' '}
                <code>.25</code>, but before 2022 it was set to <code>.15</code>, so any entered <code>ell</code> value
                is adjusted by <code>-.1</code> in each year before 2022.
              </Typography>
            </Stack>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
