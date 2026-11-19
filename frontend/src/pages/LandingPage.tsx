import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid2 as Grid,
  Rating,
  Stack,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckIcon from '@mui/icons-material/CheckCircle'
import CloseIcon from '@mui/icons-material/RemoveCircleOutline'
import SearchIcon from '@mui/icons-material/Search'
import AssignmentIcon from '@mui/icons-material/AssignmentTurnedIn'
import SupportIcon from '@mui/icons-material/HealthAndSafety'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { api } from '../api/client'
import type { Faq, Paginated, PlansResponse, PublicFeedback } from '../api/types'
import { ErrorState, Loading, usePageTitle } from '../components/feedback'
import { formatDate, formatPercent } from '../lib/format'

const STEPS = [
  { icon: <SearchIcon />, title: 'Cote', text: 'Informe o IMEI e veja na hora o preço de cada plano.' },
  {
    icon: <AssignmentIcon />,
    title: 'Contrate',
    text: 'Crie sua conta e pague com Pix ou cartão. A apólice sai na hora.',
  },
  { icon: <SupportIcon />, title: 'Use', text: 'Aconteceu algo? Acione pelo site e acompanhe cada etapa.' },
  {
    icon: <AutorenewIcon />,
    title: 'Renove',
    text: 'A assinatura é mensal e se renova sozinha. Cancele quando quiser.',
  },
]

export function LandingPage() {
  usePageTitle('Seguro de celular contra roubo, furto e quebra')
  const location = useLocation()
  const plans = useQuery({ queryKey: ['plans'], queryFn: async () => (await api.get<PlansResponse>('/plans')).data })
  const faqs = useQuery({ queryKey: ['faqs'], queryFn: async () => (await api.get<Faq[]>('/faqs')).data })
  const feedbacks = useQuery({
    queryKey: ['feedbacks', 'public'],
    queryFn: async () =>
      (await api.get<Paginated<PublicFeedback> & { averageRating: number | null }>('/feedbacks?pageSize=6')).data,
  })

  // Links do menu para âncoras (#planos, #duvidas)
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [location.hash, plans.isSuccess])

  return (
    <>
      {/* Seção inicial */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #312e81 0%, #4338ca 55%, #6366f1 100%)',
          color: 'white',
          py: { xs: 7, md: 11 },
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Chip label="Contratação 100% online" sx={{ bgcolor: 'rgba(255,255,255,.15)', color: 'white', mb: 2 }} />
              <Typography variant="h1">Seu celular protegido contra roubo, furto e quebra</Typography>
              <Typography sx={{ mt: 2, fontSize: '1.15rem', opacity: 0.9, maxWidth: 560 }}>
                Cote pelo IMEI em segundos, pague por mês e acione o seguro pelo site quando precisar.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }}>
                <Button
                  component={RouterLink}
                  to="/cotacao"
                  variant="contained"
                  size="large"
                  sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: '#e0e7ff' } }}
                >
                  Faça sua cotação
                </Button>
                <Button
                  href="#planos"
                  size="large"
                  sx={{ color: 'white', borderColor: 'rgba(255,255,255,.6)' }}
                  variant="outlined"
                >
                  Conhecer os planos
                </Button>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,.08)', color: 'white', borderColor: 'rgba(255,255,255,.2)' }}>
                <CardContent>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>Por que contratar?</Typography>
                  {[
                    'Planos a partir de R$ 19,90 por mês',
                    'Sem fidelidade: cancele quando quiser',
                    'Acompanhe o sinistro em tempo real',
                    'Pix ou cartão de crédito',
                  ].map((t) => (
                    <Box key={t} sx={{ display: 'flex', gap: 1, alignItems: 'center', py: 0.5 }}>
                      <CheckIcon fontSize="small" aria-hidden /> <Typography>{t}</Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Como funciona */}
      <Container maxWidth="lg" sx={{ py: 8 }} component="section" aria-labelledby="como-funciona">
        <Typography variant="h2" id="como-funciona" textAlign="center">
          Como funciona
        </Typography>
        <Grid container spacing={3} sx={{ mt: 3 }}>
          {STEPS.map((s, i) => (
            <Grid key={s.title} size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ color: 'primary.main', mb: 1 }} aria-hidden>
                    {s.icon}
                  </Box>
                  <Typography variant="h5" component="h3">
                    {i + 1}. {s.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {s.text}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Planos e coberturas (da API) */}
      <Box sx={{ bgcolor: 'white', py: 8 }} component="section" id="planos" aria-labelledby="titulo-planos">
        <Container maxWidth="lg">
          <Typography variant="h2" id="titulo-planos" textAlign="center">
            Planos e coberturas
          </Typography>
          <Typography textAlign="center" color="text.secondary" sx={{ mt: 1 }}>
            O preço depende do valor do seu aparelho. Faça a cotação para ver o valor exato.
          </Typography>
          {plans.isLoading && <Loading />}
          {plans.isError && <ErrorState error={plans.error} onRetry={() => plans.refetch()} />}
          {plans.data && (
            <Grid container spacing={3} sx={{ mt: 3 }}>
              {plans.data.plans.map((p) => (
                <Grid key={p.id} size={{ xs: 12, md: 4 }}>
                  <Card
                    sx={{
                      height: '100%',
                      borderColor: p.code === 'INTERMEDIARIO' ? 'primary.main' : undefined,
                      borderWidth: p.code === 'INTERMEDIARIO' ? 2 : 1,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h4" component="h3">
                          {p.name}
                        </Typography>
                        {p.code === 'INTERMEDIARIO' && <Chip label="Mais escolhido" color="primary" size="small" />}
                      </Box>
                      <Typography color="text.secondary" sx={{ mt: 1, minHeight: 48 }}>
                        {p.description}
                      </Typography>
                      <Typography sx={{ mt: 2, fontWeight: 600 }}>
                        {formatPercent(p.monthlyRateBps)} do valor do aparelho por mês
                      </Typography>
                      <Box component="ul" sx={{ listStyle: 'none', p: 0, mt: 2 }}>
                        {plans.data.coverages.map((c) => {
                          const pc = p.coverages.find((x) => x.code === c.code)
                          return (
                            <Box
                              component="li"
                              key={c.code}
                              sx={{ display: 'flex', gap: 1, py: 0.75, color: pc ? 'text.primary' : 'text.disabled' }}
                            >
                              {pc ? (
                                <CheckIcon color="success" fontSize="small" aria-label="Incluído" />
                              ) : (
                                <CloseIcon fontSize="small" aria-label="Não incluído" />
                              )}
                              <Box>
                                <Typography>{c.name}</Typography>
                                {pc && (
                                  <Typography variant="body2" color="text.secondary">
                                    Franquia de {formatPercent(pc.deductibleBps)} · carência de {c.gracePeriodDays} dias
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          )
                        })}
                      </Box>
                      <Button
                        component={RouterLink}
                        to="/cotacao"
                        variant={p.code === 'INTERMEDIARIO' ? 'contained' : 'outlined'}
                        fullWidth
                        sx={{ mt: 2 }}
                      >
                        Cotar o plano {p.name}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Container>
      </Box>

      {/* Avaliações */}
      <Container maxWidth="lg" sx={{ py: 8 }} component="section" aria-labelledby="titulo-avaliacoes">
        <Typography variant="h2" id="titulo-avaliacoes" textAlign="center">
          O que dizem nossos clientes
        </Typography>
        {feedbacks.data?.averageRating && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mt: 1 }}>
            <Rating
              value={feedbacks.data.averageRating}
              precision={0.1}
              readOnly
              aria-label={`Nota média ${feedbacks.data.averageRating}`}
            />
            <Typography color="text.secondary">
              {feedbacks.data.averageRating} de 5 · {feedbacks.data.meta.total} avaliações
            </Typography>
          </Box>
        )}
        {feedbacks.isLoading && <Loading />}
        {feedbacks.data && feedbacks.data.data.length === 0 && (
          <Typography textAlign="center" color="text.secondary" sx={{ mt: 3 }}>
            Ainda não há avaliações publicadas.
          </Typography>
        )}
        <Grid container spacing={3} sx={{ mt: 2 }}>
          {feedbacks.data?.data.map((f) => (
            <Grid key={f.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Rating value={f.rating} readOnly size="small" aria-label={`${f.rating} estrelas`} />
                  {f.comment && <Typography sx={{ mt: 1 }}>“{f.comment}”</Typography>}
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    {f.author} · {formatDate(f.createdAt)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        <Box textAlign="center" sx={{ mt: 3 }}>
          <Button component={RouterLink} to="/conta/avaliar">
            Já é cliente? Deixe sua avaliação
          </Button>
        </Box>
      </Container>

      {/* Dúvidas frequentes */}
      <Box sx={{ bgcolor: 'white', py: 8 }} component="section" id="duvidas" aria-labelledby="titulo-faq">
        <Container maxWidth="md">
          <Typography variant="h2" id="titulo-faq" textAlign="center" sx={{ mb: 3 }}>
            Dúvidas frequentes
          </Typography>
          {faqs.isLoading && <Loading />}
          {faqs.isError && <ErrorState error={faqs.error} onRetry={() => faqs.refetch()} />}
          {faqs.data?.map((f) => (
            <Accordion key={f.id} disableGutters variant="outlined">
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ fontWeight: 600 }}>{f.question}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography color="text.secondary">{f.answer}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
          <Box textAlign="center" sx={{ mt: 4 }}>
            <Typography color="text.secondary">Não encontrou o que procurava?</Typography>
            <Button component={RouterLink} to="/conta/suporte/novo" sx={{ mt: 1 }}>
              Fale com o atendimento
            </Button>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h2">Proteja seu celular hoje</Typography>
        <Button component={RouterLink} to="/cotacao" variant="contained" size="large" sx={{ mt: 3 }}>
          Faça sua cotação
        </Button>
      </Container>
    </>
  )
}
