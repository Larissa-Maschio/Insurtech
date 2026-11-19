import { Chip } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

/** Prova de vida da Fase 1: o front consulta /api/health (API + banco). */
export function HealthBadge() {
  const { data, isError, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get<{ status: string; database: string; time: string }>('/health')).data,
    refetchInterval: 60_000,
    retry: false,
  })
  const label = isLoading
    ? 'Verificando sistema…'
    : isError
      ? 'Sistema indisponível'
      : `Sistema online · banco ${data?.database}`
  return (
    <Chip
      size="small"
      label={label}
      color={isError ? 'error' : isLoading ? 'default' : 'success'}
      variant="outlined"
      sx={{ color: 'inherit' }}
      data-testid="health"
    />
  )
}
