import type {
  ClaimStatus,
  CoverageCode,
  FeedbackStatus,
  PaymentMethod,
  PaymentStatus,
  PolicyStatus,
  SubscriptionStatus,
  TicketCategory,
  TicketStatus,
} from '../api/types'

export const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatPercent = (bps: number) => `${(bps / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'

export const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export const onlyDigits = (v: string) => v.replace(/\D/g, '')

export function maskImei(v: string) {
  const d = onlyDigits(v).slice(0, 15)
  return [d.slice(0, 2), d.slice(2, 8), d.slice(8, 14), d.slice(14)].filter(Boolean).join('-')
}

export function maskCpf(v: string) {
  const d = onlyDigits(v).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

export function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Mesmo algoritmo do backend (Luhn), para validar o IMEI na hora. */
export function isValidImei(imei: string) {
  if (!/^\d{15}$/.test(imei)) return false
  let sum = 0
  for (let i = 0; i < 15; i++) {
    let d = Number(imei[14 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

export function isValidCpf(input: string) {
  const cpf = onlyDigits(input)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const dv = (len: number) => {
    let s = 0
    for (let i = 0; i < len; i++) s += Number(cpf[i]) * (len + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10])
}

type Tone = 'default' | 'success' | 'warning' | 'error' | 'info'

export const COVERAGE_LABEL: Record<CoverageCode, string> = {
  ROUBO: 'Roubo',
  FURTO_QUALIFICADO: 'Furto qualificado',
  QUEBRA_ACIDENTAL: 'Quebra acidental',
  DANO_LIQUIDO: 'Dano por líquido',
  FURTO_SIMPLES: 'Furto simples',
}

export const POLICY_STATUS: Record<PolicyStatus, [string, Tone]> = {
  AGUARDANDO_PAGAMENTO: ['Aguardando pagamento', 'warning'],
  ATIVA: ['Ativa', 'success'],
  SUSPENSA: ['Suspensa', 'error'],
  CANCELADA: ['Cancelada', 'default'],
  ENCERRADA: ['Encerrada', 'default'],
}

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, [string, Tone]> = {
  PENDENTE: ['Pendente', 'warning'],
  ATIVA: ['Em dia', 'success'],
  INADIMPLENTE: ['Em atraso', 'warning'],
  SUSPENSA: ['Suspensa', 'error'],
  CANCELADA: ['Cancelada', 'default'],
}

export const PAYMENT_STATUS: Record<PaymentStatus, [string, Tone]> = {
  PENDENTE: ['Pendente', 'warning'],
  APROVADO: ['Aprovado', 'success'],
  RECUSADO: ['Recusado', 'error'],
  EXPIRADO: ['Expirado', 'default'],
}

export const CLAIM_STATUS: Record<ClaimStatus, [string, Tone]> = {
  ABERTO: ['Aberto', 'info'],
  EM_ANALISE: ['Em análise', 'warning'],
  APROVADO: ['Aprovado', 'success'],
  NEGADO: ['Negado', 'error'],
  AGUARDANDO_FRANQUIA: ['Aguardando franquia', 'warning'],
  CONCLUIDO: ['Concluído', 'success'],
}

export const TICKET_STATUS: Record<TicketStatus, [string, Tone]> = {
  ABERTO: ['Aberto', 'info'],
  EM_ANDAMENTO: ['Em andamento', 'warning'],
  RESOLVIDO: ['Resolvido', 'success'],
}

export const FEEDBACK_STATUS: Record<FeedbackStatus, [string, Tone]> = {
  PENDENTE: ['Pendente', 'warning'],
  APROVADO: ['Aprovado', 'success'],
  REJEITADO: ['Rejeitado', 'default'],
}

export const TICKET_CATEGORY: Record<TicketCategory, string> = {
  COTACAO: 'Cotação',
  PAGAMENTO: 'Pagamento',
  APOLICE: 'Apólice',
  SINISTRO: 'Sinistro',
  OUTROS: 'Outros',
}

export const METHOD_LABEL: Record<PaymentMethod, string> = { PIX: 'Pix', CARTAO: 'Cartão de crédito' }
