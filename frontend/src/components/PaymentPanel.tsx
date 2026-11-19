import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import PixIcon from '@mui/icons-material/QrCode2'
import CardIcon from '@mui/icons-material/CreditCard'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import type { Payment, PaymentMethod } from '../api/types'
import { formatBRL, PAYMENT_STATUS } from '../lib/format'
import { StatusChip } from './feedback'

export function MethodPicker({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  return (
    <ToggleButtonGroup
      exclusive
      value={value}
      onChange={(_, v) => v && onChange(v)}
      aria-label="Forma de pagamento"
      fullWidth
      color="primary"
    >
      <ToggleButton value="PIX" aria-label="Pix">
        <PixIcon sx={{ mr: 1 }} />
        Pix
      </ToggleButton>
      <ToggleButton value="CARTAO" aria-label="Cartão de crédito">
        <CardIcon sx={{ mr: 1 }} />
        Cartão de crédito
      </ToggleButton>
    </ToggleButtonGroup>
  )
}

/** Mostra o estado de um pagamento: Pix com QR Code, link do checkout do cartão, aprovado ou recusado. */
export function PaymentPanel({ payment, onRetry }: { payment: Payment; onRetry?: () => void }) {
  const [copied, setCopied] = useState(false)

  if (payment.status === 'APROVADO') {
    return <Alert severity="success">Pagamento de {formatBRL(payment.amountCents)} aprovado. Obrigado!</Alert>
  }
  if (payment.status === 'RECUSADO' || payment.status === 'EXPIRADO') {
    return (
      <Alert
        severity={payment.status === 'RECUSADO' ? 'error' : 'warning'}
        action={
          onRetry && (
            <Button color="inherit" onClick={onRetry}>
              Tentar novamente
            </Button>
          )
        }
      >
        {payment.status === 'RECUSADO'
          ? `Pagamento recusado${payment.failureReason ? `: ${payment.failureReason}` : ''}. Tente de novo ou use outra forma de pagamento.`
          : 'Esta cobrança expirou. Gere uma nova para pagar.'}
      </Alert>
    )
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2} alignItems="center" textAlign="center">
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <CircularProgress size={18} aria-hidden />
          <Typography sx={{ fontWeight: 600 }}>
            {payment.method === 'PIX' ? 'Aguardando o pagamento do Pix' : 'Aguardando a confirmação do cartão'}
          </Typography>
          <StatusChip value={PAYMENT_STATUS[payment.status]} />
        </Box>
        <Typography variant="h4" component="p">
          {formatBRL(payment.amountCents)}
        </Typography>

        {payment.method === 'PIX' && payment.pixQrCode && (
          <>
            <Box sx={{ p: 2, bgcolor: 'white', border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <QRCodeSVG value={payment.pixQrCode} size={200} aria-label="QR Code do Pix" />
            </Box>
            <TextField
              label="Pix copia e cola"
              value={payment.pixQrCode}
              slotProps={{ input: { readOnly: true } }}
              size="small"
            />
            <Button
              variant="outlined"
              onClick={async () => {
                await navigator.clipboard?.writeText(payment.pixQrCode!)
                setCopied(true)
              }}
            >
              {copied ? 'Código copiado!' : 'Copiar código Pix'}
            </Button>
          </>
        )}

        {payment.method === 'CARTAO' && payment.checkoutUrl && (
          <>
            <Typography color="text.secondary">
              O cartão é digitado no ambiente seguro do gateway de pagamento. Nós não recebemos os dados do seu cartão.
            </Typography>
            {payment.checkoutUrl.startsWith(window.location.origin) ? (
              <Button
                variant="contained"
                size="large"
                component={RouterLink}
                to={payment.checkoutUrl.slice(window.location.origin.length)}
              >
                Ir para o pagamento com cartão
              </Button>
            ) : (
              <Button variant="contained" size="large" href={payment.checkoutUrl}>
                Ir para o pagamento com cartão
              </Button>
            )}
          </>
        )}

        <Typography variant="body2" color="text.secondary" aria-live="polite">
          Esta página se atualiza sozinha quando o pagamento for confirmado.
        </Typography>
        {payment.method === 'PIX' && (
          <Button component={RouterLink} to={`/pagamento/${payment.id}/checkout-simulado`} size="small">
            Ambiente de testes: simular pagamento do Pix
          </Button>
        )}
      </Stack>
    </Paper>
  )
}
