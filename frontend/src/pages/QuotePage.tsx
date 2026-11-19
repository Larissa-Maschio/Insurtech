import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import PhoneIcon from '@mui/icons-material/PhoneIphone'
import { useMutation } from '@tanstack/react-query'
import { FormEvent, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { api, errorCode, errorMessage } from '../api/client'
import type { Quote } from '../api/types'
import { usePageTitle } from '../components/feedback'
import { isValidImei, maskImei, onlyDigits } from '../lib/format'
import { saveLastQuote, getLastQuote } from '../lib/storage'

const REJECTION_TITLE: Record<string, string> = {
  APARELHO_BLOQUEADO: 'Aparelho com restrição',
  APARELHO_ANTIGO: 'Modelo fora da idade aceita',
  VALOR_FORA_DA_FAIXA: 'Valor do aparelho fora da faixa aceita',
  MODELO_NAO_ENCONTRADO: 'Modelo ainda não atendido',
  APOLICE_EXISTENTE: 'Aparelho já segurado',
  IMEI_SERVICO_INDISPONIVEL: 'Consulta temporariamente indisponível',
}

export function QuotePage() {
  usePageTitle('Cotação pelo IMEI')
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const digits = onlyDigits(value)
  const localError =
    digits.length === 0
      ? 'Informe o IMEI'
      : digits.length < 15
        ? `Faltam ${15 - digits.length} dígitos`
        : !isValidImei(digits)
          ? 'IMEI inválido: confira os números digitados'
          : null
  const last = getLastQuote()

  const mutation = useMutation({
    mutationFn: async () => (await api.post<Quote>('/quotes', { imei: digits })).data,
    onSuccess: (quote) => {
      saveLastQuote(quote.id)
      navigate(`/cotacao/${quote.id}`)
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!localError) mutation.mutate()
  }

  const code = errorCode(mutation.error)

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Typography variant="h2" component="h1">
        Cotação do seguro
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        Informe o IMEI do celular para ver os planos e preços. Não é preciso ter conta.
      </Typography>

      <Card sx={{ mt: 4 }}>
        <CardContent component="form" onSubmit={submit} noValidate>
          <TextField
            label="IMEI do aparelho"
            value={maskImei(value)}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            error={touched && !!localError}
            helperText={touched && localError ? localError : '15 dígitos. Disque *#06# no celular para ver o seu IMEI.'}
            slotProps={{
              htmlInput: { inputMode: 'numeric', autoComplete: 'off', 'aria-describedby': 'dica-imei' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIcon aria-hidden />
                  </InputAdornment>
                ),
              },
            }}
            autoFocus
          />
          <Button type="submit" variant="contained" size="large" fullWidth sx={{ mt: 3 }} disabled={mutation.isPending}>
            {mutation.isPending ? 'Consultando aparelho…' : 'Ver planos'}
          </Button>

          {mutation.isError && (
            <Alert
              severity={code === 'IMEI_SERVICO_INDISPONIVEL' ? 'warning' : 'error'}
              sx={{ mt: 3 }}
              role="alert"
              action={
                code === 'IMEI_SERVICO_INDISPONIVEL' ? (
                  <Button color="inherit" onClick={() => mutation.mutate()}>
                    Tentar de novo
                  </Button>
                ) : undefined
              }
            >
              {code && REJECTION_TITLE[code] && <AlertTitle>{REJECTION_TITLE[code]}</AlertTitle>}
              {errorMessage(mutation.error)}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Box id="dica-imei" sx={{ mt: 3, p: 2, bgcolor: '#eef2ff', borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 600 }}>Como descobrir o IMEI?</Typography>
        <Typography variant="body2" color="text.secondary">
          Abra o discador, digite <strong>*#06#</strong> e o número aparece na tela. Também está em Configurações ›
          Sobre o telefone e na caixa do aparelho. Se houver dois IMEIs, use o primeiro.
        </Typography>
      </Box>

      {last && (
        <Alert
          severity="info"
          sx={{ mt: 3 }}
          action={
            <Button color="inherit" component={RouterLink} to={`/cotacao/${last}`}>
              Retomar
            </Button>
          }
        >
          Você tem uma cotação salva neste navegador.
        </Alert>
      )}
    </Container>
  )
}
