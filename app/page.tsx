'use client'

import {
  AppBar,
  Box,
  Button,
  Card,
  CardHeader,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Typography,
  useColorScheme,
} from '@mui/material'
import {useRef, useState, type MouseEvent} from 'react'
import {Close, DarkMode, LightMode, Menu as MenuIcon} from '@mui/icons-material'
import {DataMenu} from './parts/data_menu'
import {DataView} from './data/view'
import {DataDisplay} from './data/display'
import {FormulaDrawer} from './parts/formula_drawer'
import {MainMenu} from './parts/menu'

const MENU_WIDTH = 350
const DRAWER_HEIGHT = 33

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(true)
  const [rightPos, setRightPos] = useState(MENU_WIDTH)
  const resizeAnimationFrame = useRef<number | NodeJS.Timeout>(-1)
  const {mode, setMode} = useColorScheme()
  const isDark = mode === 'dark'
  const [drawerHeight, setDrawerHeight] = useState(DRAWER_HEIGHT)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const toggleMenu = (e: MouseEvent<HTMLElement>) => setAnchor(anchor ? null : e.currentTarget)
  const resize = () => {
    resizeAnimationFrame.current = setInterval(() => window.dispatchEvent(new Event('resize')), 100)
    setTimeout(() => clearInterval(resizeAnimationFrame.current), 500)
  }
  setTimeout(() => window.dispatchEvent(new Event('resize')), 100)
  const toggleFormulaDrawer = (e: MouseEvent<HTMLElement>) => {
    toggleMenu(e)
    setDrawerOpen(!drawerOpen)
    resize()
  }
  return (
    <DataView>
      <Box component="main">
        <AppBar sx={{width: `calc(100% - ${rightPos}px)`, left: 0}}>
          <Toolbar variant="dense" sx={{justifyContent: 'space-between', pl: 1, pr: 1, height: '48px'}} disableGutters>
            <Typography variant="h6" sx={{fontSize: {md: '1.25em', sm: '.7em', xs: '.6em'}}}>
              CT Education Funding
            </Typography>
            <Stack direction="row">
              <IconButton
                color="inherit"
                onClick={() => setMode(isDark ? 'light' : 'dark')}
                aria-label="toggle dark mode"
              >
                {isDark ?
                  <LightMode />
                : <DarkMode />}
              </IconButton>
              <IconButton
                color="inherit"
                id="menu-control"
                aria-controls={anchor ? 'menu-items' : undefined}
                aria-haspopup="true"
                aria-expanded={!!anchor}
                onClick={toggleMenu}
              >
                <MenuIcon />
              </IconButton>
              <MainMenu anchor={anchor} setAnchor={setAnchor} toggleFormulaDrawer={toggleFormulaDrawer} />
              {!menuOpen && (
                <Button
                  disableRipple
                  variant="text"
                  color="inherit"
                  onClick={() => {
                    setMenuOpen(!menuOpen)
                    resize()
                    setRightPos(rightPos ? 0 : MENU_WIDTH)
                  }}
                >
                  Data Menu
                </Button>
              )}
            </Stack>
          </Toolbar>
        </AppBar>
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
