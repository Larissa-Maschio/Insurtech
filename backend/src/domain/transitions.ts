import {
  ClaimStatus,
  PolicyStatus,
  SubscriptionStatus,
  TicketStatus,
} from '@prisma/client';
import { AppException } from '../common/app-exception';

/** Transições permitidas de cada fluxo (Fase 2). Qualquer outra é rejeitada. */
export const POLICY_TRANSITIONS: Record<PolicyStatus, PolicyStatus[]> = {
  AGUARDANDO_PAGAMENTO: ['ATIVA', 'CANCELADA'],
  ATIVA: ['SUSPENSA', 'CANCELADA', 'ENCERRADA'],
  SUSPENSA: ['ATIVA', 'CANCELADA'],
  CANCELADA: [],
  ENCERRADA: [],
};

export const SUBSCRIPTION_TRANSITIONS: Record<
  SubscriptionStatus,
  SubscriptionStatus[]
> = {
  PENDENTE: ['ATIVA', 'CANCELADA'],
  ATIVA: ['INADIMPLENTE', 'CANCELADA'],
  INADIMPLENTE: ['ATIVA', 'SUSPENSA', 'CANCELADA'],
  SUSPENSA: ['ATIVA', 'CANCELADA'],
  CANCELADA: [],
};

export const CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  ABERTO: ['EM_ANALISE'],
  EM_ANALISE: ['APROVADO', 'NEGADO'],
  APROVADO: ['AGUARDANDO_FRANQUIA', 'CONCLUIDO'],
  AGUARDANDO_FRANQUIA: ['CONCLUIDO'],
  NEGADO: [],
  CONCLUIDO: [],
};

export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  ABERTO: ['EM_ANDAMENTO', 'RESOLVIDO'],
  EM_ANDAMENTO: ['ABERTO', 'RESOLVIDO'],
  RESOLVIDO: ['ABERTO'],
};

export function canTransition<S extends string>(
  map: Record<S, S[]>,
  from: S,
  to: S,
): boolean {
  return from === to || map[from].includes(to);
}

export function assertTransition<S extends string>(
  map: Record<S, S[]>,
  from: S,
  to: S,
  what: string,
) {
  if (!canTransition(map, from, to)) {
    throw new AppException(
      'TRANSICAO_INVALIDA',
      `Não é possível mudar ${what} de "${from}" para "${to}".`,
      409,
    );
  }
}
