import {CandlestickChart, Download, Functions, Help} from '@mui/icons-material'
import {ListItemIcon, ListItemText, Menu, MenuItem} from '@mui/material'
import {ProfileDisplay} from './profile'
import {Export} from './export'
import {useContext, useState, type MouseEvent} from 'react'
import {ViewActionContext} from '../data/view'
import {DataContext, type Resources} from '../data/load'
import {About} from './about'

export function MainMenu({
  anchor,
  setAnchor,
  toggleFormulaDrawer,
}: {
  anchor: HTMLElement | null
  setAnchor: (anchor: HTMLElement | null) => void
  toggleFormulaDrawer: (e: MouseEvent<HTMLElement>) => void
}) {
  const viewAction = useContext(ViewActionContext)
  const {meta} = useContext(DataContext) as Resources
  const [exportOpen, setExportOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const close = () => setAnchor(null)
  return (
    <>
      <Menu
        id="menu-items"
        anchorEl={anchor}
        slotProps={{list: {'aria-labelledby': 'menu-control'}}}
        open={!!anchor}
        onClose={close}
      >
        <MenuItem
          onClick={() => {
            close()
            setAboutOpen(!aboutOpen)
          }}
        >
          <ListItemIcon>
            <Help />
          </ListItemIcon>
          <ListItemText>About</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            close()
            viewAction({key: 'profile', value: Object.keys(meta.entities)[0]})
          }}
        >
          <ListItemIcon>
            <CandlestickChart />
          </ListItemIcon>
          <ListItemText>District Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={toggleFormulaDrawer}>
          <ListItemIcon>
            <Functions />
          </ListItemIcon>
          <ListItemText>Formula</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setExportOpen(!exportOpen)
            setAnchor(null)
          }}
        >
          <ListItemIcon>
            <Download />
          </ListItemIcon>
          <ListItemText>Export</ListItemText>
        </MenuItem>
      </Menu>
      <About open={aboutOpen} setOpen={setAboutOpen} />
      <ProfileDisplay />
      <Export open={exportOpen} setOpen={setExportOpen} />
    </>
  )
}
