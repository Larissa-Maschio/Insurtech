import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  Divider,
  FormControlLabel,
  Grid2 as Grid,
  Link,
  Stack,
  Typography,
} from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '../../api/client'
import type { Payment, PaymentMethod, Quote } from '../../api/types'
import { ErrorState, Loading, PageHeader } from '../../components/feedback'
import { MethodPicker } from '../../components/PaymentPanel'
import { formatBRL, formatDate } from '../../lib/format'
import { clearLastQuote } from '../../lib/storage'

export function CheckoutPage() {
  const { quoteId, plan: planCode } = useParams()
  const navigate = useNavigate()
  const [method, setMethod] = useState<PaymentMethod>('PIX')
  const [accepted, setAccepted] = useState(false)
  const quote = useQuery({
    queryKey: ['quote', quoteId],
    queryFn: async () => (await api.get<Quote>(`/quotes/${quoteId}`)).data,
  })

  const purchase = useMutation({
    mutationFn: async () =>
      (await api.post<{ policyId: string; payment: Payment }>('/policies', { quoteId, planId: planCode, method })).data,
    onSuccess: (res) => {
      clearLastQuote()
      navigate(`/pagamento/${res.payment.id}`)
    },
  })

  if (quote.isLoading) return <Loading />
  if (quote.isError || !quote.data)
    return (
      <Container sx={{ py: 6 }}>
        <ErrorState error={quote.error} />
      </Container>
    )

  const q = quote.data
  const plan = q.plans.find((p) => p.code === planCode)
  if (!plan)
    return (
      <Container sx={{ py: 6 }}>
        <Alert severity="error">Plano não encontrado nesta cotação.</Alert>
      </Container>
    )

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <PageHeader title="Revisar e contratar" subtitle="Confira os dados antes de pagar." />
      {q.expired && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" component={RouterLink} to="/cotacao">
              Cotar novamente
            </Button>
          }
        >
          Esta cotação expirou.
        </Alert>
      )}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="h4" component="h2">
                Resumo
              </Typography>
              <Stack spacing={1} sx={{ mt: 2 }}>
                <Row label="Aparelho" value={`${q.brand} ${q.model}`} />
                <Row label="IMEI" value={q.imei} />
                <Row label="Valor de referência" value={formatBRL(q.deviceValueCents)} />
                <Row label="Plano" value={plan.name} />
                <Row label="Mensalidade" value={<strong>{formatBRL(plan.monthlyPriceCents)}</strong>} />
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h5" component="h3">
                Coberturas
              </Typography>
              <Box
                component="table"
                sx={{
                  width: '100%',
                  mt: 1,
                  borderCollapse: 'collapse',
                  '& td, & th': { py: 1, borderBottom: '1px solid #e5e7eb', textAlign: 'left' },
                }}
              >
                <thead>
                  <tr>
                    <th>Cobertura</th>
                    <th>Franquia</th>
                    <th>Carência</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.coverages.map((c) => (
                    <tr key={c.code}>
                      <td>{c.name}</td>
                      <td>{formatBRL(c.deductibleCents)}</td>
                      <td>{c.gracePeriodDays} dias</td>
                    </tr>
                  ))}
                </tbody>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                A cobrança é mensal e renovada automaticamente. Cancele quando quiser: a cobertura vale até o fim do mês
                pago. Cotação válida até {formatDate(q.expiresAt)}.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <Typography variant="h4" component="h2">
                Pagamento
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                Escolha como pagar a primeira mensalidade.
              </Typography>
              <MethodPicker value={method} onChange={setMethod} />
              <FormControlLabel
                sx={{ mt: 2 }}
                control={<Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />}
                label={
                  <>
                    Li e aceito as{' '}
                    <Link component={RouterLink} to="/termos" target="_blank">
                      condições gerais do seguro
                    </Link>
                    .
                  </>
                }
              />
              {purchase.isError && (
                <Alert severity="error" sx={{ mt: 2 }} role="alert">
                  {errorMessage(purchase.error)}
                </Alert>
              )}
              <Button
                variant="contained"
                size="large"
                fullWidth
                sx={{ mt: 2 }}
                disabled={!accepted || purchase.isPending || q.expired}
                onClick={() => purchase.mutate()}
              >
                {purchase.isPending ? 'Gerando pagamento…' : `Pagar ${formatBRL(plan.monthlyPriceCents)}`}
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Ambiente de testes: nenhuma cobrança real será feita.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography textAlign="right">{value}</Typography>
    </Box>
  )
}
