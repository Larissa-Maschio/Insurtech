import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Grid2 as Grid,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../../api/client'
import type { Claim, Payment, PaymentMethod, Policy } from '../../api/types'
import { ClaimTimeline, DocumentList, DocumentUpload } from '../../components/claims'
import { EmptyState, ErrorState, Loading, PageHeader, StatusChip } from '../../components/feedback'
import { MethodPicker, PaymentPanel } from '../../components/PaymentPanel'
import { CLAIM_STATUS, COVERAGE_LABEL, formatBRL, formatDate, formatDateTime } from '../../lib/format'
import { ClaimForm, claimSchema } from '../../lib/schemas'

export function ClaimsPage() {
  const claims = useQuery({ queryKey: ['claims'], queryFn: async () => (await api.get<Claim[]>('/claims')).data })
  return (
    <>
      <PageHeader
        title="Sinistros"
        subtitle="Acione o seguro e acompanhe a análise."
        action={
          <Button variant="contained" component={RouterLink} to="/conta/sinistros/novo">
            Acionar o seguro
          </Button>
        }
      />
      {claims.isLoading && <Loading />}
      {claims.isError && <ErrorState error={claims.error} onRetry={() => claims.refetch()} />}
      {claims.data?.length === 0 && (
        <EmptyState
          title="Nenhum sinistro"
          description="Tomara que continue assim! Se algo acontecer, acione por aqui."
        />
      )}
      <Stack spacing={2}>
        {claims.data?.map((c) => (
          <Card key={c.id}>
            <CardActionArea component={RouterLink} to={`/conta/sinistros/${c.id}`}>
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="h5" component="h2">
                    {COVERAGE_LABEL[c.type]} · {c.policy.device}
                  </Typography>
                  <Typography color="text.secondary">
                    {c.number} · aberto em {formatDate(c.createdAt)}
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

const STEPS = ['Apólice e ocorrido', 'Documentos', 'Pronto']

export function NewClaimPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [claim, setClaim] = useState<Claim | null>(null)
  const policies = useQuery({
    queryKey: ['policies'],
    queryFn: async () => (await api.get<Policy[]>('/policies')).data,
  })
  const active = policies.data?.filter((p) => p.status === 'ATIVA') ?? []

  const { control, handleSubmit, watch, formState } = useForm<ClaimForm>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      policyId: params.get('apolice') ?? '',
      type: undefined,
      occurredAt: '',
      location: '',
      description: '',
    },
  })
  const policyId = watch('policyId')
  const selected = active.find((p) => p.id === policyId)

  const create = useMutation({
    mutationFn: async (data: ClaimForm) =>
      (await api.post<Claim>('/claims', { ...data, occurredAt: new Date(data.occurredAt).toISOString() })).data,
    onSuccess: setClaim,
  })

  const step = claim ? 1 : 0
  const e = formState.errors

  return (
    <>
      <PageHeader title="Acionar o seguro" />
      <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
        {STEPS.map((s) => (
          <Step key={s}>
            <StepLabel>{s}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {policies.isLoading && <Loading />}
      {policies.data && active.length === 0 && (
        <EmptyState
          title="Nenhuma apólice ativa"
          description="É preciso ter uma apólice ativa para acionar o seguro."
          action={
            <Button component={RouterLink} to="/conta/apolices">
              Ver minhas apólices
            </Button>
          }
        />
      )}

      {!claim && active.length > 0 && (
        <Card>
          <CardContent>
            <Stack component="form" spacing={2} onSubmit={handleSubmit((d) => create.mutate(d))} noValidate>
              <Controller
                name="policyId"
                control={control}
                render={({ field }) => (
                  <TextField select label="Apólice" {...field} error={!!e.policyId} helperText={e.policyId?.message}>
                    {active.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.device.brand} {p.device.model} · {p.number} ({p.plan.name})
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    label="O que aconteceu?"
                    {...field}
                    value={field.value ?? ''}
                    error={!!e.type}
                    helperText={
                      e.type?.message ??
                      (selected ? 'Só aparecem as coberturas do seu plano.' : 'Escolha a apólice primeiro.')
                    }
                    disabled={!selected}
                  >
                    {selected?.coverages.map((c) => (
                      <MenuItem key={c.code} value={c.code} disabled={c.inGracePeriod}>
                        {c.name} · franquia {formatBRL(c.deductibleCents)}
                        {c.inGracePeriod ? ` (carência até ${formatDate(c.graceEndsAt)})` : ''}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <Controller
                name="occurredAt"
                control={control}
                render={({ field }) => (
                  <TextField
                    type="datetime-local"
                    label="Data e hora do ocorrido"
                    {...field}
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={!!e.occurredAt}
                    helperText={e.occurredAt?.message ?? 'Comunique em até 30 dias.'}
                  />
                )}
              />
              <Controller
                name="location"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="Local"
                    placeholder="Endereço, bairro, cidade"
                    {...field}
                    error={!!e.location}
                    helperText={e.location?.message}
                  />
                )}
              />
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="Descreva o que aconteceu"
                    multiline
                    minRows={4}
                    {...field}
                    error={!!e.description}
                    helperText={e.description?.message ?? `${field.value.length}/2000`}
                  />
                )}
              />
              {create.isError && (
                <Alert severity="error" role="alert">
                  {errorMessage(create.error)}
                </Alert>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="submit" variant="contained" size="large" disabled={create.isPending}>
                  {create.isPending ? 'Enviando…' : 'Continuar'}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      {claim && (
        <Stack spacing={2}>
          <Alert severity="success">
            Sinistro {claim.number} aberto. Agora envie os documentos para agilizar a análise.
          </Alert>
          <DocumentUpload claim={claim} onUploaded={() => navigate(`/conta/sinistros/${claim.id}`)} />
          <Box>
            <Button component={RouterLink} to={`/conta/sinistros/${claim.id}`}>
              Enviar depois e acompanhar o sinistro
            </Button>
          </Box>
        </Stack>
      )}
    </>
  )
}

export function ClaimDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [method, setMethod] = useState<PaymentMethod>('PIX')
  const claim = useQuery({ queryKey: ['claim', id], queryFn: async () => (await api.get<Claim>(`/claims/${id}`)).data })
  const pay = useMutation({
    mutationFn: async () => (await api.post<Payment>('/payments', { claimId: id, method })).data,
    onSuccess: (p) => navigate(`/pagamento/${p.id}`),
  })

  if (claim.isLoading) return <Loading />
  if (claim.isError || !claim.data) return <ErrorState error={claim.error} onRetry={() => claim.refetch()} />
  const c = claim.data
  const pending = c.payments.find((p) => p.status === 'PENDENTE')

  return (
    <>
      <PageHeader
        title={`Sinistro ${c.number}`}
        subtitle={`${COVERAGE_LABEL[c.type]} · ${c.policy.device} · apólice ${c.policy.number}`}
        action={<StatusChip value={CLAIM_STATUS[c.status]} />}
      />
      {c.status === 'NEGADO' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <strong>Sinistro negado.</strong> Motivo: {c.decisionReason}
        </Alert>
      )}
      {c.status === 'CONCLUIDO' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Sinistro concluído. {c.events[c.events.length - 1]?.note}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          {c.status === 'AGUARDANDO_FRANQUIA' && (
            <Card sx={{ mb: 3, borderColor: 'warning.main' }}>
              <CardContent>
                <Typography variant="h4" component="h2">
                  Pagamento da franquia
                </Typography>
                <Typography sx={{ mt: 1 }}>
                  Seu sinistro foi aprovado. Pague a franquia de <strong>{formatBRL(c.deductibleCents)}</strong> para
                  seguirmos com a{' '}
                  {['ROUBO', 'FURTO_QUALIFICADO', 'FURTO_SIMPLES'].includes(c.type) ? 'reposição' : 'reparo'} do
                  aparelho.
                </Typography>
                {pending && (
                  <Box sx={{ mt: 2 }}>
                    <PaymentPanel payment={pending} />
                  </Box>
                )}
                <Box sx={{ mt: 2 }}>
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
                    {pending ? 'Gerar nova cobrança' : 'Pagar franquia'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent>
              <Typography variant="h4" component="h2" sx={{ mb: 2 }}>
                Acompanhamento
              </Typography>
              <ClaimTimeline claim={c} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <Typography variant="h4" component="h2">
                Detalhes
              </Typography>
              <Stack spacing={1} sx={{ mt: 2 }}>
                <Typography>
                  <strong>Ocorrido em:</strong> {formatDateTime(c.occurredAt)}
                </Typography>
                <Typography>
                  <strong>Local:</strong> {c.location}
                </Typography>
                <Typography>
                  <strong>Franquia:</strong> {formatBRL(c.deductibleCents)}
                </Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                  <strong>Descrição:</strong> {c.description}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h4" component="h2">
                Documentos
              </Typography>
              <DocumentList claim={c} />
              {(c.status === 'ABERTO' || c.status === 'EM_ANALISE') && (
                <Box sx={{ mt: 2 }}>
                  <DocumentUpload claim={c} />
                </Box>
              )}
            </CardContent>
          </Card>
          <Button component={RouterLink} to="/conta/suporte/novo" sx={{ mt: 2 }}>
            Dúvidas? Fale com o atendimento
          </Button>
        </Grid>
      </Grid>
    </>
  )
}
