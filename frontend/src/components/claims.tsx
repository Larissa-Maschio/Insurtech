import {
  Alert,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import UploadIcon from '@mui/icons-material/UploadFile'
import FileIcon from '@mui/icons-material/InsertDriveFile'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { api, errorMessage } from '../api/client'
import type { Claim } from '../api/types'
import { CLAIM_STATUS, formatDateTime } from '../lib/format'
import { StatusChip } from './feedback'

const MAX_FILES = 5
const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'application/pdf']

/** Linha do tempo do sinistro (claim_events). */
export function ClaimTimeline({ claim }: { claim: Claim }) {
  return (
    <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }} aria-label="Linha do tempo do sinistro">
      {claim.events.map((e, i) => {
        const last = i === claim.events.length - 1
        return (
          <Box component="li" key={e.id} sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} aria-hidden>
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  bgcolor: last ? 'primary.main' : 'grey.400',
                  mt: 0.6,
                }}
              />
              {!last && <Box sx={{ width: 2, flexGrow: 1, bgcolor: 'grey.300', my: 0.5 }} />}
            </Box>
            <Box sx={{ pb: 2.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <StatusChip value={CLAIM_STATUS[e.toStatus]} />
                <Typography variant="body2" color="text.secondary">
                  {formatDateTime(e.createdAt)} · {e.actor}
                </Typography>
              </Stack>
              {e.note && <Typography sx={{ mt: 0.5 }}>{e.note}</Typography>}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

/** Lista de documentos; o download passa pelo token (arquivo nunca é público). */
export function DocumentList({ claim }: { claim: Claim }) {
  const [error, setError] = useState<string | null>(null)
  const open = async (docId: string) => {
    setError(null)
    try {
      const res = await api.get(`/claims/${claim.id}/documents/${docId}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(errorMessage(err))
    }
  }
  if (claim.documents.length === 0) return <Typography color="text.secondary">Nenhum documento enviado.</Typography>
  return (
    <>
      {error && <Alert severity="error">{error}</Alert>}
      <List dense>
        {claim.documents.map((d) => (
          <ListItem
            key={d.id}
            secondaryAction={
              <Button size="small" onClick={() => open(d.id)}>
                Abrir
              </Button>
            }
          >
            <ListItemIcon>
              <FileIcon aria-hidden />
            </ListItemIcon>
            <ListItemText
              primary={d.name}
              secondary={`${(d.sizeBytes / 1024).toFixed(0)} KB · ${formatDateTime(d.createdAt)}`}
            />
          </ListItem>
        ))}
      </List>
    </>
  )
}

/** Envio de documentos com validação de tipo e tamanho antes de subir. */
export function DocumentUpload({ claim, onUploaded }: { claim: Claim; onUploaded?: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [localError, setLocalError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const remaining = MAX_FILES - claim.documents.length

  const upload = useMutation({
    mutationFn: async () => {
      const form = new FormData()
      files.forEach((f) => form.append('files', f))
      return (await api.post<Claim>(`/claims/${claim.id}/documents`, form)).data
    },
    onSuccess: (updated) => {
      setFiles([])
      queryClient.setQueryData(['claim', claim.id], updated)
      onUploaded?.()
    },
  })

  const pick = (list: FileList | null) => {
    setLocalError(null)
    const chosen = Array.from(list ?? [])
    const bad = chosen.find((f) => !ACCEPT.includes(f.type))
    const big = chosen.find((f) => f.size > MAX_BYTES)
    if (bad) return setLocalError(`"${bad.name}" não é JPG, PNG ou PDF.`)
    if (big) return setLocalError(`"${big.name}" tem mais de 5 MB.`)
    if (chosen.length > remaining) return setLocalError(`Você pode enviar mais ${remaining} arquivo(s).`)
    setFiles(chosen)
  }

  if (remaining <= 0) return <Alert severity="info">Limite de {MAX_FILES} documentos atingido.</Alert>

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography sx={{ fontWeight: 600 }}>Documentos necessários</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 1 }}>
        {claim.requiredDocuments.map((d) => (
          <Chip key={d} label={d} size="small" />
        ))}
      </Box>
      <Typography variant="body2" color="text.secondary">
        JPG, PNG ou PDF, até 5 MB cada (máximo {MAX_FILES} por sinistro).
      </Typography>
      <input
        ref={input}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.pdf"
        hidden
        onChange={(e) => pick(e.target.files)}
        aria-label="Selecionar documentos"
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
        <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => input.current?.click()}>
          Selecionar arquivos
        </Button>
        <Button variant="contained" disabled={!files.length || upload.isPending} onClick={() => upload.mutate()}>
          {upload.isPending ? 'Enviando…' : `Enviar ${files.length || ''} arquivo(s)`}
        </Button>
      </Stack>
      {files.length > 0 && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {files.map((f) => f.name).join(', ')}
        </Typography>
      )}
      {localError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {localError}
        </Alert>
      )}
      {upload.isError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {errorMessage(upload.error)}
        </Alert>
      )}
    </Paper>
  )
}
