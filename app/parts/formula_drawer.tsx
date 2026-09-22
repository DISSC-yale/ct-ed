import {Close} from '@mui/icons-material'
import {Box, Button, Card, CardActions, CardContent, CardHeader, Drawer, IconButton, Typography} from '@mui/material'
import {useCallback, useContext, useEffect, useState} from 'react'
import FormulaMenu from '../data/formula_menu'
import {FormulaEditor} from '../data/view'
import {background} from '../data/load'
import type {Formula} from '../data/formula'
import {FormulaGraphDisplay} from './formula_graph_display'

let resizeAnimationFrame = -1
const heightTracker = {value: 0}
export function FormulaDrawer({
  open,
  setOpen,
  height,
  setHeight,
  rightPos,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  height: number
  setHeight: (height: number) => void
  rightPos: number
}) {
  const editFormula = useContext(FormulaEditor)
  heightTracker.value = height
  const resize = useCallback(
    (e: MouseEvent) => {
      const value = Math.max(18, Math.min(Math.ceil((1 - e.y / window.innerHeight) * 100), 87))
      if (value !== heightTracker.value) {
        cancelAnimationFrame(resizeAnimationFrame)
        resizeAnimationFrame = requestAnimationFrame(() => {
          setHeight(value)
          window.dispatchEvent(new Event('resize'))
        })
      }
    },
    [setHeight],
  )
  const [resizing, setResizing] = useState(false)
  const startResize = useCallback(
    (e: React.MouseEvent) => {
      setResizing(true)
      e.preventDefault()
      document.body.style.cursor = 'ns-resize'
      window.addEventListener('mousemove', resize)
    },
    [resize],
  )
  useEffect(() => {
    const endResize = (e: MouseEvent) => {
      if (resizeAnimationFrame !== -1) {
        cancelAnimationFrame(resizeAnimationFrame)
        setResizing(false)
        resizeAnimationFrame = -1
        document.body.style.cursor = 'default'
        window.removeEventListener('mousemove', resize)
        const value = Math.max(18, Math.min(Math.ceil((1 - e.y / window.innerHeight) * 100), 87))
        setHeight(value)
        window.dispatchEvent(new Event('resize'))
      }
    }
    window.addEventListener('mouseup', endResize)
    return () => window.removeEventListener('mouseup', endResize)
  }, [resize, setHeight])
  const toggle = () => {
    setOpen(!open)
  }
  return (
    open && (
      <Drawer
        open={open}
        onClose={toggle}
        variant="permanent"
        hideBackdrop={true}
        anchor="bottom"
        sx={{
          '& .MuiPaper-root': {
            height: height + 'vh',
            right: rightPos + 'px',
            transition: 'right 200ms',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          },
        }}
      >
        <Card>
          <Box
            sx={{
              width: '100%',
              backgroundColor: '#515151',
              height: '1px',
              position: 'absolute',
              cursor: 'ns-resize',
              border: resizing ? 'solid 2px #4595ff' : '',
              '&:hover': {border: 'solid 2px #b4d5ff'},
            }}
            onMouseDownCapture={startResize}
          ></Box>
          <CardHeader
            sx={{p: 1}}
            action={
              <IconButton aria-label="Close formula menu" onClick={toggle} className="close-button">
                <Close />
              </IconButton>
            }
            title="Entitlement Formula"
            subheader={
              <Typography variant="caption" sx={{opacity: 0.75}}>
                These apply to the "Computed" variables, which are version of the ECS formula components.
              </Typography>
            }
          />
          <CardContent sx={{pb: 0, pt: 0, height: '100%', overflow: 'auto'}}>
            <FormulaMenu />
          </CardContent>
          <CardActions sx={{justifyContent: 'flex-end', p: 0}}>
            <FormulaGraphDisplay />
            <Button
              onClick={() => {
                editFormula({key: 'set', value: (background.formula as Formula).reset()})
              }}
            >
              Reset
            </Button>
          </CardActions>
        </Card>
      </Drawer>
    )
  )
}
