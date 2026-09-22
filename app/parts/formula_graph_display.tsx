import {Close} from '@mui/icons-material'
import {Box, Button, Dialog, DialogContent, DialogTitle, IconButton} from '@mui/material'
import {useState} from 'react'
import dynamic from 'next/dynamic'

const FormulaGraph = dynamic(() => import('./formula_graph'))

export function FormulaGraphDisplay() {
  const [open, setOpen] = useState(false)
  const toggle = () => setOpen(!open)
  return (
    <>
      <Button variant="text" onClick={toggle}>
        Graph
      </Button>
      <Dialog open={open} onClose={toggle} fullScreen sx={{'& .MuiDialog-container': {alignItems: 'flex-start'}}}>
        <DialogTitle sx={{p: 1}}>Formula Graph</DialogTitle>
        <IconButton
          aria-label="close import menu"
          onClick={toggle}
          sx={{
            position: 'absolute',
            right: 8,
            top: 12,
          }}
          className="close-button"
        >
          <Close />
        </IconButton>
        <DialogContent sx={{p: 1, height: '100%', overflow: 'hidden'}}>
          <FormulaGraph />
        </DialogContent>
      </Dialog>
    </>
  )
}
