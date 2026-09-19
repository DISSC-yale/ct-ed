import {Close, Download} from '@mui/icons-material'
import {
  Autocomplete,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import {ColumnTable} from 'arquero'
import {useContext, useMemo, useState} from 'react'
import {DataContext, Resources} from '../data/load'
import {SelectedContext, ViewContext, ViewDef} from '../data/view'

function makePartialName(filtered: ColumnTable, view: ViewDef, version: string) {
  return `ct_ed_${version}${
    view.time_agg === 'all' ? '' : '_' + (view.time_agg === 'specified' ? view.select_time : view.time_agg + '-time')
  }_${filtered.numRows()}`
}
export function Export() {
  const full = useContext(DataContext) as Resources
  const view = useContext(ViewContext) as ViewDef
  const selected = useContext(SelectedContext)

  const [open, setOpen] = useState(false)
  const [fullExport, setFullExport] = useState(false)
  const data = useMemo(() => (fullExport ? full.data : selected), [fullExport, full.data, selected])
  const allColumns = useMemo(() => data.columnNames(), [data])
  const [columns, setColumns] = useState(allColumns)
  const [filename, setFilename] = useState('')
  const defaultNames = useMemo(() => {
    const partial = makePartialName(selected, view, full.meta.updated)
    setFilename(partial)
    setColumns(allColumns.filter(col => (view.time_agg === 'mean' ? col !== 'year' : true)))
    return {
      partial,
      full: `wid_ggg_${full.meta.updated}${
        view.time_agg === 'all' ?
          ''
        : '_' + (view.time_agg === 'specified' ? view.select_time : view.time_agg + '-time')
      }`,
    }
  }, [selected, view, allColumns, full.meta.updated])
  const close = () => setOpen(!open)
  return (
    <>
      <Button color="inherit" onClick={close} startIcon={<Download />}>
        Export
      </Button>
      {open && (
        <Dialog open={open} onClose={close} hideBackdrop>
          <DialogTitle sx={{pt: 1, pb: 1}}>Data Export</DialogTitle>
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
          <DialogContent sx={{width: 500, maxWidth: '100%', pt: 1}}>
            <Stack spacing={1}>
              <TextField
                fullWidth
                size="small"
                label="Filename"
                value={filename}
                onChange={e => setFilename(e.target.value)}
              >
                {filename}
              </TextField>
              <Autocomplete
                options={allColumns}
                sx={{'& li': {p: 0}}}
                getOptionDisabled={option => view.time_agg === 'mean' && option === 'year'}
                renderOption={(props, option, {selected}) => {
                  const {key, ...optionProps} = props
                  return (
                    <li key={key} {...optionProps}>
                      <Checkbox checked={selected} />
                      {option}
                    </li>
                  )
                }}
                renderInput={params => <TextField {...params} label="Columns" />}
                value={columns}
                renderValue={() => <Typography sx={{p: 1, pt: 0, pb: 0}}>Selected: {columns.length}</Typography>}
                multiple
                disableCloseOnSelect
                fullWidth
                size="small"
                onChange={(_, selection) => setColumns(selection)}
              ></Autocomplete>
              <FormControlLabel
                sx={{float: 'right'}}
                label="Full Dataset"
                labelPlacement="start"
                control={
                  <Switch
                    checked={fullExport}
                    onChange={() => {
                      if (filename === defaultNames[fullExport ? 'full' : 'partial']) {
                        defaultNames.partial = makePartialName(selected, view, full.meta.updated)
                        setFilename(defaultNames[fullExport ? 'partial' : 'full'])
                      }
                      setFullExport(!fullExport)
                    }}
                  />
                }
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{justifyContent: 'right'}}>
            <Typography>CSV file with {data.numRows()} rows</Typography>
            <Button
              variant="contained"
              onClick={() => {
                const e = document.createElement('a')
                document.body.appendChild(e)
                e.rel = 'noreferrer'
                e.target = '_blank'
                e.download = filename + '.csv'
                e.href = URL.createObjectURL(new Blob([data.toCSV({columns})], {type: 'text/csv; charset=utf-8'}))
                setTimeout(function () {
                  e.dispatchEvent(new MouseEvent('click'))
                  URL.revokeObjectURL(e.href)
                  document.body.removeChild(e)
                }, 0)
              }}
            >
              Download
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  )
}
