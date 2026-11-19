import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid2 as Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '../../api/client'
import type { Payment, PaymentMethod, PlansResponse, Policy } from '../../api/types'
import { EmptyState, ErrorState, Loading, PageHeader, StatusChip } from '../../components/feedback'
import { MethodPicker, PaymentPanel } from '../../components/PaymentPanel'
import {
  formatBRL,
  formatDate,
  formatPercent,
  METHOD_LABEL,
  PAYMENT_STATUS,
  POLICY_STATUS,
  SUBSCRIPTION_STATUS,
} from '../../lib/format'

export function PoliciesPage() {
  const policies = useQuery({
    queryKey: ['policies'],
    queryFn: async () => (await api.get<Policy[]>('/policies')).data,
  })

  return (
    <>
      <PageHeader
        title="Minhas apólices"
        action={
          <Button variant="contained" component={RouterLink} to="/cotacao">
            Nova cotação
          </Button>
        }
      />
      {policies.isLoading && <Loading />}
      {policies.isError && <ErrorState error={policies.error} onRetry={() => policies.refetch()} />}
      {policies.data?.length === 0 && (
        <EmptyState
          title="Você ainda não tem apólices"
          description="Faça uma cotação pelo IMEI e contrate em poucos minutos."
          action={
            <Button variant="contained" component={RouterLink} to="/cotacao">
              Fazer cotação
            </Button>
          }
        />
      )}
      <Grid container spacing={2}>
        {policies.data?.map((p) => (
          <Grid key={p.id} size={{ xs: 12, md: 6 }}>
            <Card>
              <CardActionArea component={RouterLink} to={`/conta/apolices/${p.id}`}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="h5" component="h2">
                      {p.device.brand} {p.device.model}
                    </Typography>
                    <StatusChip value={POLICY_STATUS[p.status]} />
                  </Box>
                  <Typography color="text.secondary">
                    Apólice {p.number} · Plano {p.plan.name}
                  </Typography>
                  <Typography sx={{ mt: 1 }}>
                    {formatBRL(p.monthlyPriceCents)}/mês
                    {p.endsAt && p.status === 'ATIVA' && ` · coberto até ${formatDate(p.endsAt)}`}
                  </Typography>
                  {p.subscription?.openPayment && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      Há uma mensalidade aguardando pagamento.
                    </Alert>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  )
}

export function PolicyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [method, setMethod] = useState<PaymentMethod>('PIX')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [newPlan, setNewPlan] = useState('')

  const policy = useQuery({
    queryKey: ['policy', id],
    queryFn: async () => (await api.get<Policy>(`/policies/${id}`)).data,
    refetchInterval: (q) => (q.state.data?.status === 'AGUARDANDO_PAGAMENTO' ? 5000 : false),
  })
  const plans = useQuery({ queryKey: ['plans'], queryFn: async () => (await api.get<PlansResponse>('/plans')).data })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['policy', id] })
  const pay = useMutation({
    mutationFn: async () => (await api.post<Payment>('/payments', { policyId: id, method })).data,
    onSuccess: (p) => navigate(`/pagamento/${p.id}`),
  })
  const cancel = useMutation({
    mutationFn: () => api.post(`/subscriptions/${policy.data!.subscription!.id}/cancel`),
    onSuccess: () => {
      setConfirmCancel(false)
      refresh()
    },
  })
  const changePlan = useMutation({
    mutationFn: (planId: string) => api.post(`/subscriptions/${policy.data!.subscription!.id}/change-plan`, { planId }),
    onSuccess: refresh,
  })

  if (policy.isLoading) return <Loading />
  if (policy.isError || !policy.data) return <ErrorState error={policy.error} onRetry={() => policy.refetch()} />

  const p = policy.data
  const sub = p.subscription
  const needsPayment =
    sub &&
    sub.status !== 'CANCELADA' &&
    !sub.cancelAtPeriodEnd &&
    (p.status === 'AGUARDANDO_PAGAMENTO' || sub.status !== 'ATIVA' || !!sub.openPayment)

  return (
    <>
      <PageHeader
        title={`${p.device.brand} ${p.device.model}`}
        subtitle={
          <>
            Apólice {p.number} · IMEI {p.device.imei}
          </>
        }
        action={<StatusChip value={POLICY_STATUS[p.status]} />}
      />

      {p.status === 'SUSPENSA' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Cobertura suspensa por falta de pagamento. Pague a mensalidade em aberto para reativar.
        </Alert>
      )}
      {sub?.status === 'INADIMPLENTE' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Mensalidade em atraso desde {formatDate(sub.delinquentSince)}. Com 10 dias de atraso a cobertura é suspensa.
        </Alert>
      )}
      {sub?.cancelAtPeriodEnd && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Cancelamento solicitado. A cobertura vale até {formatDate(sub.currentPeriodEnd)}.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="h4" component="h2">
                Coberturas
              </Typography>
              <TableContainer>
                <Table size="small" aria-label="Coberturas da apólice">
                  <TableHead>
                    <TableRow>
                      <TableCell>Cobertura</TableCell>
                      <TableCell>Franquia</TableCell>
                      <TableCell>Pode acionar a partir de</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {p.coverages.map((c) => (
                      <TableRow key={c.code}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>
                          {formatBRL(c.deductibleCents)}
                          <Typography variant="body2" color="text.secondary">
                            {formatPercent(c.deductibleBps)} de {formatBRL(p.device.valueCents)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {c.graceEndsAt ? formatDate(c.graceEndsAt) : `${c.gracePeriodDays} dias após a ativação`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                A franquia é cobrada quando o sinistro é aprovado, antes da reposição ou do reparo. Ela é calculada como
                um percentual do valor de referência do aparelho.
              </Typography>
              {p.status === 'ATIVA' && (
                <Button
                  variant="outlined"
                  sx={{ mt: 2 }}
                  component={RouterLink}
                  to={`/conta/sinistros/novo?apolice=${p.id}`}
                >
                  Acionar o seguro
                </Button>
              )}
            </CardContent>
          </Card>

          {sub && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h4" component="h2">
                  Histórico de pagamentos
                </Typography>
                {sub.payments.length === 0 ? (
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    Nenhum pagamento ainda.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small" aria-label="Pagamentos">
                      <TableHead>
                        <TableRow>
                          <TableCell>Data</TableCell>
                          <TableCell>Referência</TableCell>
                          <TableCell>Valor</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sub.payments.map((pay) => (
                          <TableRow key={pay.id}>
                            <TableCell>{formatDate(pay.paidAt ?? pay.createdAt)}</TableCell>
                            <TableCell>
                              Mensalidade {pay.cycle} · {METHOD_LABEL[pay.method]}
                              {pay.attempt > 1 ? ` (tentativa ${pay.attempt})` : ''}
                            </TableCell>
                            <TableCell>{formatBRL(pay.amountCents)}</TableCell>
                            <TableCell>
                              <StatusChip value={PAYMENT_STATUS[pay.status]} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          {sub && (
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h4" component="h2">
                    Minha assinatura
                  </Typography>
                  <StatusChip value={SUBSCRIPTION_STATUS[sub.status]} />
                </Box>
                <Stack spacing={1} sx={{ mt: 2 }}>
                  <Info label="Plano" value={p.plan.name} />
                  <Info label="Mensalidade" value={formatBRL(p.monthlyPriceCents)} />
                  <Info label="Forma de pagamento" value={METHOD_LABEL[sub.method]} />
                  <Info
                    label="Período atual"
                    value={
                      sub.currentPeriodStart
                        ? `${formatDate(sub.currentPeriodStart)} a ${formatDate(sub.currentPeriodEnd)}`
                        : '—'
                    }
                  />
                  <Info label="Próxima cobrança" value={formatDate(sub.nextBillingAt)} />
                  {sub.pendingPlan && (
                    <Info label="Troca agendada" value={`${sub.pendingPlan.name} no próximo ciclo`} />
                  )}
                </Stack>

                {sub.openPayment && (
                  <Box sx={{ mt: 2 }}>
                    <Typography sx={{ fontWeight: 600, mb: 1 }}>Cobrança em aberto</Typography>
                    <PaymentPanel payment={sub.openPayment} />
                  </Box>
                )}

                {needsPayment && (
                  <Box sx={{ mt: 3 }}>
                    <Typography sx={{ fontWeight: 600, mb: 1 }}>
                      {sub.openPayment ? 'Ou gere uma nova cobrança' : 'Pagar mensalidade'}
                    </Typography>
                    <MethodPicker value={method} onChange={setMethod} />
                    {pay.isError && (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {errorMessage(pay.error)}
                      </Alert>
                    )}
                    <Button
                      variant="contained"
                      fullWidth
                      sx={{ mt: 1 }}
                      onClick={() => pay.mutate()}
                      disabled={pay.isPending}
                    >
                      Gerar cobrança
                    </Button>
                  </Box>
                )}

                {sub.status === 'ATIVA' && !sub.cancelAtPeriodEnd && (
                  <Box sx={{ mt: 3 }}>
                    <Typography sx={{ fontWeight: 600, mb: 1 }}>Trocar de plano</Typography>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        select
                        size="small"
                        label="Novo plano"
                        value={newPlan}
                        onChange={(e) => setNewPlan(e.target.value)}
                      >
                        {plans.data?.plans.map((pl) => (
                          <MenuItem key={pl.id} value={pl.id}>
                            {pl.name}
                            {pl.id === p.plan.id ? ' (atual)' : ''}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Button
                        variant="outlined"
                        disabled={!newPlan || changePlan.isPending}
                        onClick={() => changePlan.mutate(newPlan)}
                      >
                        Agendar
                      </Button>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Vale a partir do próximo ciclo. Escolha o plano atual para desfazer.
                    </Typography>
                    {changePlan.isError && (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {errorMessage(changePlan.error)}
                      </Alert>
                    )}
                  </Box>
                )}

                {sub.status !== 'CANCELADA' && !sub.cancelAtPeriodEnd && (
                  <Button color="error" sx={{ mt: 3 }} onClick={() => setConfirmCancel(true)}>
                    Cancelar assinatura
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)}>
        <DialogTitle>Cancelar assinatura?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {sub?.status === 'ATIVA'
              ? `Não haverá novas cobranças e a cobertura continua até ${formatDate(sub?.currentPeriodEnd)}. Não há reembolso proporcional.`
              : 'A apólice será cancelada imediatamente.'}
          </DialogContentText>
          {cancel.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorMessage(cancel.error)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCancel(false)}>Manter</Button>
          <Button color="error" variant="contained" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
            Confirmar cancelamento
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography textAlign="right">{value}</Typography>
    </Box>
  )
}
