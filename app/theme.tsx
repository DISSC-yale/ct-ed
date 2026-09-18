'use client'

import {CssBaseline, ThemeProvider, createTheme} from '@mui/material'
import type {ColorSystemOptions} from '@mui/material/styles'

export const colorSchemes: {dark: ColorSystemOptions; light: ColorSystemOptions} = {
  dark: {palette: {mode: 'dark', primary: {main: '#a5cdff'}, secondary: {main: '#68abff'}}},
  light: {palette: {mode: 'light', primary: {main: '#286dc0'}, secondary: {main: '#3371e7'}}},
}

const theme = createTheme({colorSchemes: colorSchemes})

export default function Theme({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <ThemeProvider theme={theme} defaultMode="dark" noSsr>
      <div suppressHydrationWarning={true}>
        <CssBaseline enableColorScheme />
      </div>
      {children}
    </ThemeProvider>
  )
}
