import { Alert, Box, Button, Container, Stack, Typography } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '../../api/client'
import type { Payment, PaymentMethod } from '../../api/types'
import { ErrorState, Loading, PageHeader } from '../../components/feedback'
import { MethodPicker, PaymentPanel } from '../../components/PaymentPanel'
import { formatBRL } from '../../lib/format'

/** Acompanha um pagamento: processando, Pix aguardando, aprovado ou recusado. */
export function PaymentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [method, setMethod] = useState<PaymentMethod>('PIX')

  const payment = useQuery({
    queryKey: ['payment', id],
    queryFn: async () => (await api.get<Payment>(`/payments/${id}`)).data,
    // Consulta a cada 3 s enquanto o gateway não confirma.
    refetchInterval: (q) => (q.state.data?.status === 'PENDENTE' ? 3000 : false),
  })

  // Pagamento confirmado: apólice/sinistro mudaram de estado, descarta o cache para as próximas telas.
  const status = payment.data?.status
  useEffect(() => {
    if (status && status !== 'PENDENTE') {
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'payment' })
    }
  }, [status, queryClient])

  const retry = useMutation({
    mutationFn: async () => {
      const p = payment.data!
      const body = p.claimId ? { claimId: p.claimId, method } : { policyId: p.policyId, method }
      return (await api.post<Payment>('/payments', body)).data
    },
    onSuccess: (p) => {
      queryClient.invalidateQueries()
      navigate(`/pagamento/${p.id}`, { replace: true })
    },
  })

  if (payment.isLoading) return <Loading label="Processando pagamento…" />
  if (payment.isError || !payment.data)
    return (
      <Container sx={{ py: 6 }}>
        <ErrorState error={payment.error} />
      </Container>
    )

  const p = payment.data
  const back = p.claimId
    ? `/conta/sinistros/${p.claimId}`
    : p.policyId
      ? `/conta/apolices/${p.policyId}`
      : '/conta/apolices'
  const what =
    p.purpose === 'FRANQUIA'
      ? 'Franquia do sinistro'
      : p.cycle === 1
        ? 'Primeira mensalidade'
        : `Mensalidade ${p.cycle}`

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <PageHeader title="Pagamento" subtitle={`${what} · ${formatBRL(p.amountCents)}`} />
      {p.status === 'APROVADO' ? (
        <Stack spacing={2} alignItems="center" textAlign="center" role="status">
          <CheckCircleIcon color="success" sx={{ fontSize: 72 }} aria-hidden />
          <Typography variant="h4">Pagamento aprovado!</Typography>
          <Typography color="text.secondary">
            {p.purpose === 'FRANQUIA'
              ? 'Recebemos a franquia. Seu sinistro foi concluído e o atendimento seguirá com a reposição ou o reparo.'
              : p.cycle === 1
                ? 'Seu seguro está ativo. Enviamos o resumo da apólice para o seu e-mail.'
                : 'Mensalidade paga. Sua cobertura está em dia.'}
          </Typography>
          <Button variant="contained" component={RouterLink} to={back}>
            {p.claimId ? 'Ver sinistro' : 'Ver minha apólice'}
          </Button>
        </Stack>
      ) : (
        <>
          <PaymentPanel payment={p} />
          {(p.status === 'RECUSADO' || p.status === 'EXPIRADO') && (
            <Box sx={{ mt: 3 }}>
              <Typography sx={{ mb: 1, fontWeight: 600 }}>Tentar novamente com:</Typography>
              <MethodPicker value={method} onChange={setMethod} />
              {retry.isError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {errorMessage(retry.error)}
                </Alert>
              )}
              <Button
                variant="contained"
                fullWidth
                sx={{ mt: 2 }}
                onClick={() => retry.mutate()}
                disabled={retry.isPending}
              >
                Gerar nova cobrança
              </Button>
            </Box>
          )}
          <Button component={RouterLink} to={back} sx={{ mt: 3 }}>
            Voltar
          </Button>
        </>
      )}
    </Container>
  )
}

/**
 * Página do gateway SIMULADO (PAYMENT_GATEWAY=mock). Representa o ambiente do gateway onde o
 * cliente pagaria; aqui só existem os botões para simular a resposta. Nenhum dado de cartão é pedido.
 */
export function MockCheckoutPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const payment = useQuery({
    queryKey: ['payment', id],
    queryFn: async () => (await api.get<Payment>(`/payments/${id}`)).data,
  })
  const simulate = useMutation({
    mutationFn: (status: 'APROVADO' | 'RECUSADO') => api.post(`/dev/payments/${id}/simulate`, { status }),
    onSuccess: () => navigate(`/pagamento/${id}`, { replace: true }),
  })

  if (payment.isLoading) return <Loading />
  if (payment.isError || !payment.data)
    return (
      <Container sx={{ py: 6 }}>
        <ErrorState error={payment.error} />
      </Container>
    )
  const p = payment.data

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <PageHeader title="Gateway de pagamento simulado" />
      <Alert severity="info" sx={{ mb: 3 }}>
        Ambiente de testes. Num gateway real (ex.: Mercado Pago), esta etapa acontece no site do gateway, que confirma o
        pagamento por webhook. Aqui você escolhe o resultado.
      </Alert>
      <Typography variant="h4" component="p" textAlign="center">
        {formatBRL(p.amountCents)}
      </Typography>
      <Typography textAlign="center" color="text.secondary">
        {p.method === 'PIX' ? 'Pix' : 'Cartão de crédito'} · status atual: {p.status}
      </Typography>
      {p.status !== 'PENDENTE' ? (
        <Alert severity="warning" sx={{ mt: 3 }}>
          Este pagamento já foi finalizado.
        </Alert>
      ) : (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 3 }}>
          <Button
            variant="contained"
            color="success"
            fullWidth
            size="large"
            disabled={simulate.isPending}
            onClick={() => simulate.mutate('APROVADO')}
          >
            Aprovar pagamento
          </Button>
          <Button
            variant="outlined"
            color="error"
            fullWidth
            size="large"
            disabled={simulate.isPending}
            onClick={() => simulate.mutate('RECUSADO')}
          >
            Recusar pagamento
          </Button>
        </Stack>
      )}
      {simulate.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {errorMessage(simulate.error)}
        </Alert>
      )}
      <Button component={RouterLink} to={`/pagamento/${id}`} sx={{ mt: 3 }}>
        Voltar
      </Button>
    </Container>
  )
}
