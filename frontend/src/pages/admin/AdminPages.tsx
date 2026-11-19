import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid2 as Grid,
  MenuItem,
  Rating,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link as RouterLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { api, errorMessage } from '../../api/client'
import type { AdminFeedback, Claim, ClaimStatus, FeedbackStatus, Paginated } from '../../api/types'
import { ClaimTimeline, DocumentList } from '../../components/claims'
import { EmptyState, ErrorState, Loading, PageHeader, StatusChip } from '../../components/feedback'
import { CLAIM_STATUS, COVERAGE_LABEL, FEEDBACK_STATUS, formatBRL, formatDate, formatDateTime } from '../../lib/format'

const TABS = [
  { to: '/admin/sinistros', label: 'Sinistros' },
  { to: '/admin/chamados', label: 'Chamados' },
  { to: '/admin/avaliacoes', label: 'Avaliações' },
  { to: '/admin/ferramentas', label: 'Ferramentas de teste' },
]

export function AdminLayout() {
  const { pathname } = useLocation()
  const current = TABS.findIndex((t) => pathname.startsWith(t.to))
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography color="text.secondary">Painel do atendente</Typography>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={current === -1 ? false : current}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label="Painel do atendente"
        >
          {TABS.map((t) => (
            <Tab key={t.to} label={t.label} component={RouterLink} to={t.to} />
          ))}
        </Tabs>
      </Box>
      <Outlet />
    </Container>
  )
}

export function AdminClaimsPage() {
  const [status, setStatus] = useState<ClaimStatus | ''>('ABERTO')
  const claims = useQuery({
    queryKey: ['admin-claims', status],
    queryFn: async () =>
      (await api.get<Paginated<Claim>>('/admin/claims', { params: { status: status || undefined, pageSize: 50 } }))
        .data,
  })
  return (
    <>
      <PageHeader title="Sinistros" subtitle="Analise e decida os sinistros abertos." />
      <TextField
        select
        size="small"
        label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value as ClaimStatus | '')}
        sx={{ maxWidth: 240, mb: 2 }}
      >
        <MenuItem value="">Todos</MenuItem>
        {Object.entries(CLAIM_STATUS).map(([k, [label]]) => (
          <MenuItem key={k} value={k}>
            {label}
          </MenuItem>
        ))}
      </TextField>
      {claims.isLoading && <Loading />}
      {claims.isError && <ErrorState error={claims.error} onRetry={() => claims.refetch()} />}
      {claims.data?.data.length === 0 && <EmptyState title="Nenhum sinistro com este status" />}
      <Stack spacing={1.5}>
        {claims.data?.data.map((c) => (
          <Card key={c.id}>
            <CardActionArea component={RouterLink} to={`/admin/sinistros/${c.id}`}>
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="h5" component="h2">
                    {c.number} · {COVERAGE_LABEL[c.type]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {c.customer.name} · {c.policy.device} · plano {c.policy.plan} · {c.documents.length} documento(s) ·
                    aberto {formatDateTime(c.createdAt)}
                  </Typography>
                </Box>
                <StatusChip value={CLAIM_STATUS[c.status]} />
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    </>
  )
}

export function AdminClaimDetailPage() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [decision, setDecision] = useState<'approve' | 'deny' | null>(null)
  const [reason, setReason] = useState('')
  const claim = useQuery({ queryKey: ['claim', id], queryFn: async () => (await api.get<Claim>(`/claims/${id}`)).data })

  const act = useMutation({
    mutationFn: async (action: 'start-analysis' | 'approve' | 'deny') =>
      (await api.post<Claim>(`/admin/claims/${id}/${action}`, action === 'start-analysis' ? undefined : { reason }))
        .data,
    onSuccess: (c) => {
      queryClient.setQueryData(['claim', id], c)
      queryClient.invalidateQueries({ queryKey: ['admin-claims'] })
      setDecision(null)
      setReason('')
    },
  })

  if (claim.isLoading) return <Loading />
  if (claim.isError || !claim.data) return <ErrorState error={claim.error} />
  const c = claim.data
  const missingDocs = c.documents.length === 0

  return (
    <>
      <PageHeader
        title={`Sinistro ${c.number}`}
        subtitle={`${COVERAGE_LABEL[c.type]} · ${c.customer.name} (${c.customer.email})`}
        action={<StatusChip value={CLAIM_STATUS[c.status]} />}
      />
      {act.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(act.error)}
        </Alert>
      )}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="h4" component="h2">
                Ocorrido
              </Typography>
              <Stack spacing={1} sx={{ mt: 2 }}>
                <Typography>
                  <strong>Data:</strong> {formatDateTime(c.occurredAt)} · <strong>Local:</strong> {c.location}
                </Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{c.description}</Typography>
                <Typography>
                  <strong>Apólice:</strong> {c.policy.number} ({c.policy.plan}) · {c.policy.device} · IMEI{' '}
                  {c.policy.imei}
                </Typography>
                <Typography>
                  <strong>Franquia:</strong> {formatBRL(c.deductibleCents)}
                </Typography>
              </Stack>
              <Box sx={{ mt: 3 }}>
                {c.status === 'ABERTO' && (
                  <Button variant="contained" onClick={() => act.mutate('start-analysis')} disabled={act.isPending}>
                    Iniciar análise
                  </Button>
                )}
                {c.status === 'EM_ANALISE' && (
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" color="success" onClick={() => setDecision('approve')}>
                      Aprovar
                    </Button>
                    <Button variant="outlined" color="error" onClick={() => setDecision('deny')}>
                      Negar
                    </Button>
                  </Stack>
                )}
                {c.status === 'EM_ANALISE' && missingDocs && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    O cliente ainda não enviou documentos ({c.requiredDocuments.join(', ')}).
                  </Alert>
                )}
              </Box>
            </CardContent>
          </Card>
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h4" component="h2" sx={{ mb: 2 }}>
                Histórico
              </Typography>
              <ClaimTimeline claim={c} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <Typography variant="h4" component="h2">
                Documentos
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Exigidos: {c.requiredDocuments.join(', ')}
              </Typography>
              <DocumentList claim={c} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={!!decision} onClose={() => setDecision(null)} fullWidth>
        <DialogTitle>{decision === 'approve' ? 'Aprovar sinistro' : 'Negar sinistro'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Motivo (enviado ao cliente e registrado no histórico)"
            multiline
            minRows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            sx={{ mt: 1 }}
            helperText={
              decision === 'approve' && c.deductibleCents > 0
                ? `O cliente será cobrado da franquia de ${formatBRL(c.deductibleCents)}.`
                : undefined
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecision(null)}>Voltar</Button>
          <Button
            variant="contained"
            color={decision === 'approve' ? 'success' : 'error'}
            disabled={reason.trim().length < 5 || act.isPending}
            onClick={() => act.mutate(decision!)}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export function AdminFeedbacksPage() {
  const [status, setStatus] = useState<FeedbackStatus>('PENDENTE')
  const queryClient = useQueryClient()
  const list = useQuery({
    queryKey: ['admin-feedbacks', status],
    queryFn: async () =>
      (await api.get<Paginated<AdminFeedback>>('/admin/feedbacks', { params: { status, pageSize: 50 } })).data,
  })
  const moderate = useMutation({
    mutationFn: ({ id, s }: { id: string; s: FeedbackStatus }) => api.patch(`/admin/feedbacks/${id}`, { status: s }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-feedbacks'] }),
  })
  return (
    <>
      <PageHeader title="Avaliações" subtitle="Só avaliações aprovadas aparecem na página inicial." />
      <ToggleButtonGroup exclusive size="small" value={status} onChange={(_, v) => v && setStatus(v)} sx={{ mb: 2 }}>
        {Object.entries(FEEDBACK_STATUS).map(([k, [label]]) => (
          <ToggleButton key={k} value={k}>
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {list.isLoading && <Loading />}
      {list.data?.data.length === 0 && <EmptyState title="Nada por aqui" />}
      <Stack spacing={1.5}>
        {list.data?.data.map((f) => (
          <Card key={f.id}>
            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Rating value={f.rating} readOnly size="small" />
                <Typography>{f.comment ?? <em>Sem comentário</em>}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {f.customer.name} · {formatDate(f.createdAt)}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <StatusChip value={FEEDBACK_STATUS[f.status]} />
                {f.status !== 'APROVADO' && (
                  <Button size="small" onClick={() => moderate.mutate({ id: f.id, s: 'APROVADO' })}>
                    Aprovar
                  </Button>
                )}
                {f.status !== 'REJEITADO' && (
                  <Button size="small" color="error" onClick={() => moderate.mutate({ id: f.id, s: 'REJEITADO' })}>
                    Rejeitar
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </>
  )
}

interface ClockInfo {
  now: string
  offsetDays: number
  renewalOutcome: 'approve' | 'decline'
}

/** Ferramentas para demonstrar renovação/inadimplência sem esperar dias (só com ENABLE_DEV_TOOLS). */
export function AdminDevToolsPage() {
  const queryClient = useQueryClient()
  const [days, setDays] = useState(1)
  const clock = useQuery({
    queryKey: ['dev-clock'],
    queryFn: async () => (await api.get<ClockInfo>('/dev/clock')).data,
    retry: false,
  })
  const emails = useQuery({
    queryKey: ['dev-emails'],
    queryFn: async () => (await api.get<{ to: string; subject: string; html: string }[]>('/dev/emails')).data,
    retry: false,
  })
  const refresh = () => queryClient.invalidateQueries()
  const advance = useMutation({
    mutationFn: async () => (await api.post('/dev/clock/advance', { days })).data,
    onSuccess: refresh,
  })
  const reset = useMutation({ mutationFn: () => api.post('/dev/clock/reset'), onSuccess: refresh })
  const outcome = useMutation({
    mutationFn: (o: 'approve' | 'decline') => api.post('/dev/renewal-outcome', { outcome: o }),
    onSuccess: refresh,
  })
  const [open, setOpen] = useState<number | null>(null)

  if (clock.isError) return <Alert severity="info">Ferramentas de teste desativadas (ENABLE_DEV_TOOLS=false).</Alert>

  return (
    <>
      <PageHeader
        title="Ferramentas de teste"
        subtitle="Simule a passagem do tempo para demonstrar renovação, inadimplência, suspensão e cancelamento."
      />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h4" component="h2">
                Relógio do sistema
              </Typography>
              <Typography sx={{ mt: 1 }}>
                Data simulada: <strong>{formatDateTime(clock.data?.now)}</strong> ({clock.data?.offsetDays ?? 0} dias à
                frente)
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <TextField
                  type="number"
                  size="small"
                  label="Dias"
                  value={days}
                  onChange={(e) => setDays(Math.max(1, Math.min(120, Number(e.target.value))))}
                  sx={{ width: 100 }}
                />
                <Button variant="contained" onClick={() => advance.mutate()} disabled={advance.isPending}>
                  Avançar e rodar cobranças
                </Button>
                <Button onClick={() => reset.mutate()}>Voltar ao hoje</Button>
              </Stack>
              {advance.data && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Resultado: {JSON.stringify(advance.data.totals)}
                </Alert>
              )}
              {advance.isError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {errorMessage(advance.error)}
                </Alert>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Cada dia avançado executa a rotina diária: aviso de vencimento (5 dias antes), cobrança (3 dias antes),
                inadimplência no vencimento, novas tentativas nos dias 3 e 7, suspensão no dia 10 e cancelamento no dia
                30.
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h4" component="h2">
                Renovações no cartão (gateway simulado)
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={clock.data?.renewalOutcome}
                onChange={(_, v) => v && outcome.mutate(v)}
                sx={{ mt: 2 }}
              >
                <ToggleButton value="approve">Aprovar</ToggleButton>
                <ToggleButton value="decline">Recusar</ToggleButton>
              </ToggleButtonGroup>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h4" component="h2">
                E-mails enviados
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Com o docker compose, veja também no Mailpit: http://localhost:8025
              </Typography>
              <Stack spacing={1} sx={{ mt: 2, maxHeight: 520, overflow: 'auto' }}>
                {emails.data?.length === 0 && <Typography color="text.secondary">Nenhum e-mail ainda.</Typography>}
                {emails.data?.map((m, i) => (
                  <Box key={i} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                    <Typography sx={{ fontWeight: 600 }}>{m.subject}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      para {m.to}
                    </Typography>
                    <Button size="small" onClick={() => setOpen(open === i ? null : i)}>
                      {open === i ? 'Ocultar' : 'Ver texto'}
                    </Button>
                    {open === i && (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {new DOMParser()
                          .parseFromString(m.html, 'text/html')
                          .body.textContent?.replace(/\s+\n/g, '\n')
                          .trim()}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  )
}
