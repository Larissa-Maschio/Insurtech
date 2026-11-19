// Tipos espelhando o contrato da API (ver Swagger em /api/docs). Valores em centavos, datas ISO 8601.

export type Role = 'CUSTOMER' | 'ADMIN'
export type CoverageCode = 'ROUBO' | 'FURTO_QUALIFICADO' | 'QUEBRA_ACIDENTAL' | 'DANO_LIQUIDO' | 'FURTO_SIMPLES'
export type PolicyStatus = 'AGUARDANDO_PAGAMENTO' | 'ATIVA' | 'SUSPENSA' | 'CANCELADA' | 'ENCERRADA'
export type SubscriptionStatus = 'PENDENTE' | 'ATIVA' | 'INADIMPLENTE' | 'SUSPENSA' | 'CANCELADA'
export type PaymentStatus = 'PENDENTE' | 'APROVADO' | 'RECUSADO' | 'EXPIRADO'
export type PaymentMethod = 'PIX' | 'CARTAO'
export type ClaimStatus = 'ABERTO' | 'EM_ANALISE' | 'APROVADO' | 'NEGADO' | 'AGUARDANDO_FRANQUIA' | 'CONCLUIDO'
export type TicketStatus = 'ABERTO' | 'EM_ANDAMENTO' | 'RESOLVIDO'
export type TicketCategory = 'COTACAO' | 'PAGAMENTO' | 'APOLICE' | 'SINISTRO' | 'OUTROS'
export type FeedbackStatus = 'PENDENTE' | 'APROVADO' | 'REJEITADO'

export interface User {
  id: string
  name: string
  email: string
  cpf: string
  phone: string
  role: Role
}

export interface Coverage {
  code: CoverageCode
  name: string
  description: string
  gracePeriodDays: number
  deductibleBps: number
}

export interface Plan {
  id: string
  code: string
  name: string
  description: string
  monthlyRateBps: number
  coverages: Coverage[]
}

export interface PlansResponse {
  plans: Plan[]
  coverages: Omit<Coverage, 'deductibleBps'>[]
}

export interface QuotePlan extends Plan {
  monthlyPriceCents: number
  coverages: (Coverage & { deductibleCents: number })[]
}

export interface Quote {
  id: string
  imei: string
  brand: string
  model: string
  deviceValueCents: number
  expiresAt: string
  expired: boolean
  plans: QuotePlan[]
}

export interface Payment {
  id: string
  purpose: 'MENSALIDADE' | 'FRANQUIA'
  cycle: number | null
  attempt: number
  amountCents: number
  method: PaymentMethod
  status: PaymentStatus
  pixQrCode: string | null
  checkoutUrl: string | null
  failureReason: string | null
  paidAt: string | null
  createdAt: string
  policyId?: string | null
  claimId?: string | null
}

export interface Subscription {
  id: string
  status: SubscriptionStatus
  method: PaymentMethod
  cycle: number
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  nextBillingAt: string | null
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
  delinquentSince: string | null
  pendingPlan: { id: string; name: string } | null
  openPayment: Payment | null
  payments: Payment[]
}

export interface Policy {
  id: string
  number: string
  status: PolicyStatus
  device: { imei: string; brand: string; model: string; valueCents: number }
  plan: { id: string; code: string; name: string }
  monthlyPriceCents: number
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  coverages: (Coverage & { deductibleCents: number; graceEndsAt: string | null; inGracePeriod: boolean })[]
  subscription: Subscription | null
}

export interface ClaimEvent {
  id: string
  fromStatus: ClaimStatus | null
  toStatus: ClaimStatus
  note: string | null
  actor: string
  createdAt: string
}

export interface Claim {
  id: string
  number: string
  status: ClaimStatus
  type: CoverageCode
  occurredAt: string
  location: string
  description: string
  deductibleCents: number
  decisionReason: string | null
  createdAt: string
  updatedAt: string
  requiredDocuments: string[]
  policy: { id: string; number: string; status: PolicyStatus; plan: string; device: string; imei: string }
  customer: { name: string; email: string }
  documents: { id: string; name: string; mimeType: string; sizeBytes: number; createdAt: string }[]
  events: ClaimEvent[]
  payments: Payment[]
}

export interface TicketMessage {
  id: string
  body: string
  createdAt: string
  author: string
  fromStaff: boolean
}

export interface Ticket {
  id: string
  subject: string
  category: TicketCategory
  status: TicketStatus
  policy: { id: string; number: string } | null
  customer: { name: string; email: string }
  createdAt: string
  updatedAt: string
  lastMessageAt: string
  lastMessageByStaff: boolean
  messageCount?: number
  messages?: TicketMessage[]
}

export interface Paginated<T> {
  data: T[]
  meta: { page: number; pageSize: number; total: number; totalPages: number }
}

export interface Faq {
  id: string
  question: string
  answer: string
}

export interface PublicFeedback {
  id: string
  rating: number
  comment: string | null
  author: string
  createdAt: string
}

export interface AdminFeedback {
  id: string
  rating: number
  comment: string | null
  status: FeedbackStatus
  createdAt: string
  customer: { name: string; email: string }
}

export interface ApiErrorBody {
  statusCode: number
  code: string
  message: string
  details?: unknown
}
