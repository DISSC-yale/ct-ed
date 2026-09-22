'use client'

import {Box, Button, Card, CardHeader, Drawer, IconButton} from '@mui/material'
import {useState} from 'react'
import {Close} from '@mui/icons-material'
import NavBar from './parts/nav_bar'
import {Export} from './parts/export'
import {DataMenu} from './parts/data_menu'
import {DataView} from './data/view'
import {DataDisplay} from './data/display'
import {FormulaDrawer} from './parts/formula_drawer'
import {ProfileDisplay} from './parts/profile'

const MENU_WIDTH = 350
const DRAWER_HEIGHT = 33
let resizeAnimationFrame: number | NodeJS.Timeout = -1

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(true)
  const [rightPos, setRightPos] = useState(MENU_WIDTH)
  const [drawerHeight, setDrawerHeight] = useState(DRAWER_HEIGHT)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const resize = () => {
    resizeAnimationFrame = setInterval(() => window.dispatchEvent(new Event('resize')), 100)
    setTimeout(() => clearInterval(resizeAnimationFrame), 500)
  }
  setTimeout(() => window.dispatchEvent(new Event('resize')), 100)
  return (
    <DataView>
      <Box component="main">
        <NavBar>
          <ProfileDisplay />
          <Button
            variant="text"
            color="inherit"
            onClick={() => {
              setDrawerOpen(!drawerOpen)
              resize()
            }}
          >
            Formula
          </Button>
          <Export />
          <Button
            disableRipple
            variant="text"
            color="inherit"
            sx={{width: rightPos ? MENU_WIDTH - 7 : 'auto'}}
            onClick={() => {
              setMenuOpen(false)
              resize()
              setRightPos(rightPos ? 0 : MENU_WIDTH)
            }}
          >
            Data Menu
          </Button>
        </NavBar>
        <Box
          component="main"
          sx={{
            position: 'absolute',
            bottom: drawerOpen ? drawerHeight + 'vh' : 0,
            top: 48,
            left: 0,
            right: rightPos + 'px',
            transition: 'right 200ms',
            overflow: 'auto',
            pt: 1,
          }}
        >
          <DataDisplay />
        </Box>
        <FormulaDrawer
          open={drawerOpen}
          setOpen={setDrawerOpen}
          height={drawerHeight}
          setHeight={setDrawerHeight}
          rightPos={rightPos}
        />
        <Drawer variant="persistent" open={!!rightPos} anchor="right" sx={{height: '100%'}}>
          <Card sx={{width: MENU_WIDTH + 'px', height: '100%', pb: 5}}>
            <CardHeader
              title="Data Menu"
              sx={{p: 1}}
              action={
                <IconButton
                  aria-label="Close data menu panel"
                  onClick={() => {
                    setMenuOpen(!menuOpen)
                    resize()
                    setRightPos(rightPos ? 0 : MENU_WIDTH)
                  }}
                  className="close-button"
                >
                  <Close />
                </IconButton>
              }
            />
            <DataMenu />
          </Card>
        </Drawer>
      </Box>
    </DataView>
  )
}
