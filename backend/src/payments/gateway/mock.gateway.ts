import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import {
  ChargeRequest,
  ChargeResult,
  GatewayEvent,
  InvalidWebhookSignature,
  PaymentGateway,
  WebhookInput,
} from './payment-gateway';

export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';

/**
 * Gateway simulado. Pix gera um "copia e cola" fictício; cartão abre a página
 * /pagamento/:id/checkout-simulado no frontend, onde o usuário aprova ou recusa.
 * Os webhooks são assinados com HMAC-SHA256 (PAYMENT_WEBHOOK_SECRET), como num gateway real.
 */
@Injectable()
export class MockPaymentGateway extends PaymentGateway {
  readonly name = 'mock';
  private readonly secret: string;
  private readonly frontendUrl: string;
  /** Resultado automático das renovações no cartão (ajustável nos testes e pela rota de dev). */
  renewalOutcome: 'approve' | 'decline';

  constructor(config: ConfigService) {
    super();
    this.secret = config.getOrThrow('PAYMENT_WEBHOOK_SECRET');
    this.frontendUrl = config.get('FRONTEND_URL') ?? 'http://localhost:5173';
    this.renewalOutcome =
      config.get('MOCK_RENEWAL_OUTCOME') === 'decline' ? 'decline' : 'approve';
  }

  async createCharge(req: ChargeRequest): Promise<ChargeResult> {
    const gatewayId = `mock_${req.paymentId}`;
    if (req.method === PaymentMethod.PIX) {
      return {
        gatewayId,
        status: 'PENDENTE',
        pixQrCode: `00020126580014BR.GOV.BCB.PIX0136${req.paymentId}5204000053039865406${(req.amountCents / 100).toFixed(2)}5802BR5925SEGURADORA CELULAR MOCK6009SAO PAULO6304MOCK`,
      };
    }
    if (req.renewal) {
      // Débito automático no cartão salvo (simulado).
      return this.renewalOutcome === 'approve'
        ? { gatewayId, status: 'APROVADO' }
        : {
            gatewayId,
            status: 'RECUSADO',
            failureReason: 'Cartão recusado pelo emissor (simulado)',
          };
    }
    return {
      gatewayId,
      status: 'PENDENTE',
      checkoutUrl: `${this.frontendUrl}/pagamento/${req.paymentId}/checkout-simulado`,
    };
  }

  sign(rawBody: string): string {
    return createHmac('sha256', this.secret).update(rawBody).digest('hex');
  }

  /** Monta um webhook assinado, como o gateway enviaria (usado pela rota de simulação e pelos testes). */
  buildWebhook(
    paymentId: string,
    status: 'APROVADO' | 'RECUSADO',
    reason?: string,
  ) {
    const body = JSON.stringify({
      id: `evt_${randomUUID()}`,
      paymentId,
      gatewayId: `mock_${paymentId}`,
      status,
      reason,
    });
    return { body, signature: this.sign(body) };
  }

  async parseWebhook({
    headers,
    rawBody,
    body,
  }: WebhookInput): Promise<GatewayEvent | null> {
    const signature = String(headers[MOCK_SIGNATURE_HEADER] ?? '');
    const expected = this.sign(rawBody?.toString('utf8') ?? '');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new InvalidWebhookSignature('Assinatura do webhook inválida');
    }
    if (!body?.id || !body?.paymentId) return null;
    return {
      eventId: `mock:${body.id}`,
      paymentId: body.paymentId,
      gatewayId: body.gatewayId,
      status: body.status,
      failureReason: body.reason,
    };
  }
}
