import { Alert, AlertTitle, Box, Button, Chip, CircularProgress, Paper, Typography } from '@mui/material'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { ReactNode, useEffect } from 'react'
import { errorMessage } from '../api/client'

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center', py: 6 }}
    >
      <CircularProgress size={28} />
      <Typography color="text.secondary">{label}</Typography>
    </Box>
  )
}

export function ErrorState({
  error,
  onRetry,
  title = 'Não foi possível carregar',
}: {
  error: unknown
  onRetry?: () => void
  title?: string
}) {
  return (
    <Alert
      severity="error"
      sx={{ my: 2 }}
      action={
        onRetry && (
          <Button color="inherit" size="small" onClick={onRetry}>
            Tentar novamente
          </Button>
        )
      }
    >
      <AlertTitle>{title}</AlertTitle>
      {errorMessage(error)}
    </Alert>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <Paper variant="outlined" sx={{ p: 5, textAlign: 'center' }}>
      <InboxOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled' }} aria-hidden />
      <Typography variant="h5" sx={{ mt: 1 }}>
        {title}
      </Typography>
      {description && (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 3 }}>{action}</Box>}
    </Paper>
  )
}

export function StatusChip({ value }: { value: [string, 'default' | 'success' | 'warning' | 'error' | 'info'] }) {
  return (
    <Chip size="small" label={value[0]} color={value[1]} variant={value[1] === 'default' ? 'outlined' : 'filled'} />
  )
}

/** Define o título da aba (SEO e leitores de tela). */
// eslint-disable-next-line react-refresh/only-export-components
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | Seguradora de Celular`
  }, [title])
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  usePageTitle(title)
  return (
    <Box
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end', justifyContent: 'space-between', mb: 3 }}
    >
      <Box>
        <Typography variant="h3" component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Box>
  )
}
