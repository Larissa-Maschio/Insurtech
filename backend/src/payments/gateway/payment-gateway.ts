import { PaymentMethod } from '@prisma/client';

export interface ChargeRequest {
  /** Id do nosso registro de pagamento (vai como referência externa no gateway). */
  paymentId: string;
  amountCents: number;
  method: PaymentMethod;
  description: string;
  payer: { email: string; name: string; cpf: string };
  /** Cobrança recorrente de renovação (o mock pode debitar o cartão automaticamente). */
  renewal?: boolean;
}

export interface ChargeResult {
  gatewayId: string;
  status: 'PENDENTE' | 'APROVADO' | 'RECUSADO';
  pixQrCode?: string;
  checkoutUrl?: string;
  failureReason?: string;
}

/** Evento normalizado recebido por webhook. */
export interface GatewayEvent {
  /** Id único do evento no gateway (idempotência). */
  eventId: string;
  paymentId: string;
  gatewayId: string;
  status: 'APROVADO' | 'RECUSADO' | 'EXPIRADO' | 'PENDENTE';
  failureReason?: string;
}

export interface WebhookInput {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
  body: any;
  rawBody: Buffer | undefined;
}

export class InvalidWebhookSignature extends Error {}

/**
 * Contrato do gateway de pagamento. O backend nunca recebe número de cartão:
 * cartão é pago em checkout hospedado (checkoutUrl) e Pix por QR Code.
 */
export abstract class PaymentGateway {
  abstract readonly name: string;
  abstract createCharge(req: ChargeRequest): Promise<ChargeResult>;
  /** Valida a assinatura e normaliza o evento. Retorna null para eventos irrelevantes. */
  abstract parseWebhook(input: WebhookInput): Promise<GatewayEvent | null>;
}
