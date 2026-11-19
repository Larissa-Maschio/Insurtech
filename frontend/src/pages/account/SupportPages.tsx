import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  MenuItem,
  Paper,
  Rating,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '../../api/client'
import type { Paginated, Policy, Ticket, TicketStatus } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState, ErrorState, Loading, PageHeader, StatusChip } from '../../components/feedback'
import { formatDateTime, TICKET_CATEGORY, TICKET_STATUS } from '../../lib/format'
import { TicketForm, ticketSchema } from '../../lib/schemas'

export function TicketsPage({ admin = false }: { admin?: boolean }) {
  const [status, setStatus] = useState<TicketStatus | ''>('')
  const tickets = useQuery({
    queryKey: ['tickets', status],
    queryFn: async () =>
      (await api.get<Paginated<Ticket>>('/tickets', { params: { status: status || undefined, pageSize: 50 } })).data,
  })
  const base = admin ? '/admin/chamados' : '/conta/suporte'

  return (
    <>
      <PageHeader
        title={admin ? 'Chamados de suporte' : 'Suporte'}
        subtitle={
          admin ? 'Responda e acompanhe os chamados dos clientes.' : 'Abra um chamado e converse com nosso atendimento.'
        }
        action={
          !admin && (
            <Button variant="contained" component={RouterLink} to="/conta/suporte/novo">
              Abrir chamado
            </Button>
          )
        }
      />
      <TextField
        select
        size="small"
        label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value as TicketStatus | '')}
        sx={{ maxWidth: 220, mb: 2 }}
      >
        <MenuItem value="">Todos</MenuItem>
        {Object.entries(TICKET_STATUS).map(([k, [label]]) => (
          <MenuItem key={k} value={k}>
            {label}
          </MenuItem>
        ))}
      </TextField>
      {tickets.isLoading && <Loading />}
      {tickets.isError && <ErrorState error={tickets.error} onRetry={() => tickets.refetch()} />}
      {tickets.data?.data.length === 0 && (
        <EmptyState
          title="Nenhum chamado"
          description={admin ? 'Nada por aqui com este filtro.' : 'Quando precisar, abra um chamado.'}
        />
      )}
      <Stack spacing={1.5}>
        {tickets.data?.data.map((t) => (
          <Card key={t.id}>
            <CardActionArea component={RouterLink} to={`${base}/${t.id}`}>
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="h5" component="h2">
                    {t.subject}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {TICKET_CATEGORY[t.category]}
                    {admin && ` · ${t.customer.name}`} · atualizado {formatDateTime(t.lastMessageAt)}
                    {admin && !t.lastMessageByStaff && t.status !== 'RESOLVIDO' && ' · aguardando resposta'}
                  </Typography>
                </Box>
                <StatusChip value={TICKET_STATUS[t.status]} />
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    </>
  )
}

export function NewTicketPage() {
  const navigate = useNavigate()
  const policies = useQuery({
    queryKey: ['policies'],
    queryFn: async () => (await api.get<Policy[]>('/policies')).data,
  })
  const { control, handleSubmit, formState } = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { subject: '', category: undefined, policyId: '', message: '' },
  })
  const create = useMutation({
    mutationFn: async (d: TicketForm) =>
      (await api.post<Ticket>('/tickets', { ...d, policyId: d.policyId || undefined })).data,
    onSuccess: (t) => navigate(`/conta/suporte/${t.id}`),
  })
  const e = formState.errors

  return (
    <>
      <PageHeader title="Abrir chamado" subtitle="Respondemos em até 1 dia útil." />
      <Card>
        <CardContent>
          <Stack component="form" spacing={2} onSubmit={handleSubmit((d) => create.mutate(d))} noValidate>
            <Controller
              name="subject"
              control={control}
              render={({ field }) => (
                <TextField label="Assunto" {...field} error={!!e.subject} helperText={e.subject?.message} />
              )}
            />
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  label="Categoria"
                  {...field}
                  value={field.value ?? ''}
                  error={!!e.category}
                  helperText={e.category?.message}
                >
                  {Object.entries(TICKET_CATEGORY).map(([k, v]) => (
                    <MenuItem key={k} value={k}>
                      {v}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="policyId"
              control={control}
              render={({ field }) => (
                <TextField select label="Apólice relacionada (opcional)" {...field} value={field.value ?? ''}>
                  <MenuItem value="">Nenhuma</MenuItem>
                  {policies.data?.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.device.brand} {p.device.model} · {p.number}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="message"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Mensagem"
                  multiline
                  minRows={5}
                  {...field}
                  error={!!e.message}
                  helperText={e.message?.message}
                />
              )}
            />
            {create.isError && <Alert severity="error">{errorMessage(create.error)}</Alert>}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" variant="contained" disabled={create.isPending}>
                Enviar chamado
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </>
  )
}

export function TicketDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const ticket = useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => (await api.get<Ticket>(`/tickets/${id}`)).data,
  })
  const onDone = (t: Ticket) => {
    queryClient.setQueryData(['ticket', id], t)
    queryClient.invalidateQueries({ queryKey: ['tickets'] })
  }
  const send = useMutation({
    mutationFn: async () => (await api.post<Ticket>(`/tickets/${id}/messages`, { body })).data,
    onSuccess: (t) => {
      setBody('')
      onDone(t)
    },
  })
  const setStatus = useMutation({
    mutationFn: async (status: TicketStatus) =>
      (await api.patch<Ticket>(`/admin/tickets/${id}/status`, { status })).data,
    onSuccess: onDone,
  })

  if (ticket.isLoading) return <Loading />
  if (ticket.isError || !ticket.data) return <ErrorState error={ticket.error} onRetry={() => ticket.refetch()} />
  const t = ticket.data

  return (
    <>
      <PageHeader
        title={t.subject}
        subtitle={`${TICKET_CATEGORY[t.category]}${t.policy ? ` · apólice ${t.policy.number}` : ''}${isAdmin ? ` · ${t.customer.name} (${t.customer.email})` : ''}`}
        action={<StatusChip value={TICKET_STATUS[t.status]} />}
      />
      {isAdmin && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
          {(['EM_ANDAMENTO', 'RESOLVIDO', 'ABERTO'] as TicketStatus[])
            .filter((s) => s !== t.status)
            .map((s) => (
              <Button
                key={s}
                variant="outlined"
                size="small"
                onClick={() => setStatus.mutate(s)}
                disabled={setStatus.isPending}
              >
                Marcar como {TICKET_STATUS[s][0].toLowerCase()}
              </Button>
            ))}
          {setStatus.isError && <Alert severity="error">{errorMessage(setStatus.error)}</Alert>}
        </Stack>
      )}
      <Stack spacing={1.5} aria-live="polite">
        {t.messages?.map((m) => (
          <Paper
            key={m.id}
            variant="outlined"
            sx={{
              p: 2,
              maxWidth: '85%',
              alignSelf: m.fromStaff === isAdmin ? 'flex-end' : 'flex-start',
              bgcolor: m.fromStaff ? '#eef2ff' : 'white',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {m.author} · {formatDateTime(m.createdAt)}
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{m.body}</Typography>
          </Paper>
        ))}
      </Stack>
      <Card sx={{ mt: 3 }}>
        <CardContent>
          {t.status === 'RESOLVIDO' && !isAdmin && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Este chamado foi resolvido. Se enviar uma nova mensagem, ele será reaberto.
            </Alert>
          )}
          <TextField
            label={isAdmin ? 'Responder ao cliente' : 'Sua mensagem'}
            multiline
            minRows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {send.isError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {errorMessage(send.error)}
            </Alert>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button component={RouterLink} to={isAdmin ? '/admin/chamados' : '/conta/suporte'}>
              Voltar
            </Button>
            <Button variant="contained" onClick={() => send.mutate()} disabled={!body.trim() || send.isPending}>
              Enviar
            </Button>
          </Box>
        </CardContent>
      </Card>
    </>
  )
}

export function FeedbackPage() {
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const send = useMutation({ mutationFn: () => api.post('/feedbacks', { rating, comment: comment || undefined }) })

  return (
    <>
      <PageHeader title="Avalie nosso serviço" subtitle="Sua avaliação aparece na página inicial depois de revisada." />
      <Card sx={{ maxWidth: 600 }}>
        <CardContent>
          {send.isSuccess ? (
            <Alert severity="success">Obrigado pela avaliação! Ela será publicada após revisão.</Alert>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography component="legend" sx={{ fontWeight: 600 }}>
                  Sua nota
                </Typography>
                <Rating value={rating} onChange={(_, v) => setRating(v)} size="large" aria-label="Nota de 1 a 5" />
              </Box>
              <TextField
                label="Comentário (opcional)"
                multiline
                minRows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                helperText={`${comment.length}/500`}
              />
              {send.isError && <Alert severity="error">{errorMessage(send.error)}</Alert>}
              <Button variant="contained" disabled={!rating || send.isPending} onClick={() => send.mutate()}>
                Enviar avaliação
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>
    </>
  )
}
