import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid2 as Grid,
  Stack,
  Typography,
} from '@mui/material'
import CheckIcon from '@mui/icons-material/CheckCircle'
import { useQuery } from '@tanstack/react-query'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Quote } from '../api/types'
import { ErrorState, Loading, usePageTitle } from '../components/feedback'
import { formatBRL, formatDate, formatPercent } from '../lib/format'

export function QuoteResultPage() {
  usePageTitle('Planos para o seu aparelho')
  const { id } = useParams()
  const quote = useQuery({ queryKey: ['quote', id], queryFn: async () => (await api.get<Quote>(`/quotes/${id}`)).data })

  if (quote.isLoading) return <Loading label="Carregando cotação…" />
  if (quote.isError || !quote.data)
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <ErrorState error={quote.error} title="Cotação não encontrada" />
        <Button component={RouterLink} to="/cotacao" variant="contained">
          Fazer nova cotação
        </Button>
      </Container>
    )

  const q = quote.data
  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h2" component="h1">
        Planos para o seu {q.brand} {q.model}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        IMEI {q.imei} · valor de referência {formatBRL(q.deviceValueCents)} · cotação válida até{' '}
        {formatDate(q.expiresAt)}
      </Typography>

      {q.expired && (
        <Alert
          severity="warning"
          sx={{ mt: 3 }}
          action={
            <Button color="inherit" component={RouterLink} to="/cotacao">
              Cotar novamente
            </Button>
          }
        >
          Esta cotação expirou. Faça uma nova cotação para contratar.
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {q.plans.map((p) => (
          <Grid key={p.id} size={{ xs: 12, md: 4 }}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderColor: p.code === 'INTERMEDIARIO' ? 'primary.main' : undefined,
                borderWidth: p.code === 'INTERMEDIARIO' ? 2 : 1,
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h4" component="h2">
                    {p.name}
                  </Typography>
                  {p.code === 'INTERMEDIARIO' && <Chip label="Recomendado" color="primary" size="small" />}
                </Box>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {p.description}
                </Typography>
                <Typography sx={{ mt: 2 }}>
                  <Box component="span" sx={{ fontSize: '2rem', fontWeight: 800 }}>
                    {formatBRL(p.monthlyPriceCents)}
                  </Box>
                  <Box component="span" color="text.secondary">
                    {' '}
                    /mês
                  </Box>
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography sx={{ fontWeight: 600, mb: 1 }}>Coberturas e franquias</Typography>
                <Stack spacing={1}>
                  {p.coverages.map((c) => (
                    <Box key={c.code} sx={{ display: 'flex', gap: 1 }}>
                      <CheckIcon color="success" fontSize="small" aria-hidden sx={{ mt: 0.3 }} />
                      <Box>
                        <Typography>{c.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Franquia {formatBRL(c.deductibleCents)} ({formatPercent(c.deductibleBps)}) · carência{' '}
                          {c.gracePeriodDays} dias
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
              <Box sx={{ p: 2, pt: 0 }}>
                <Button
                  component={RouterLink}
                  to={`/contratar/${q.id}/${p.code}`}
                  variant={p.code === 'INTERMEDIARIO' ? 'contained' : 'outlined'}
                  size="large"
                  fullWidth
                  disabled={q.expired}
                >
                  Contratar {p.name}
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        A franquia é o valor que você paga se o sinistro for aprovado. Carência é o prazo, contado do início da apólice,
        para poder acionar cada cobertura.
      </Typography>
    </Container>
  )
}
