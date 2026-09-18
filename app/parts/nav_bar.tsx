'use client'

import {DarkMode, LightMode} from '@mui/icons-material'
import {AppBar, IconButton, Stack, Toolbar, Typography, useColorScheme} from '@mui/material'

export default function NavBar({children}: Readonly<{children?: React.ReactNode}>) {
  const {mode, setMode} = useColorScheme()
  const isDark = mode === 'dark'
  return (
    <AppBar>
      <Toolbar variant="dense" sx={{justifyContent: 'space-between', pl: 1, pr: 1, height: '48px'}} disableGutters>
        <Typography variant="h6" sx={{fontSize: {md: '1.25em', sm: '.7em', xs: '.6em'}}}>
          CT Education Funding
        </Typography>
        <Stack direction="row" spacing={1} sx={{'& .MuiButtonBase-root': {ml: {md: 1, sm: 0, xs: 0}}}}>
          <IconButton color="inherit" onClick={() => setMode(isDark ? 'light' : 'dark')} aria-label="toggle dark mode">
            {isDark ?
              <LightMode />
            : <DarkMode />}
          </IconButton>
          {children}
        </Stack>
      </Toolbar>
    </AppBar>
  )
}
