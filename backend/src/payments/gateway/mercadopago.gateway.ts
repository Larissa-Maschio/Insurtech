import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  ChargeRequest,
  ChargeResult,
  GatewayEvent,
  InvalidWebhookSignature,
  PaymentGateway,
  WebhookInput,
} from './payment-gateway';

const API = 'https://api.mercadopago.com';

/**
 * Integração com o Mercado Pago (use SEMPRE credenciais de teste: MERCADOPAGO_ACCESS_TOKEN=TEST-...).
 * - Pix: POST /v1/payments com payment_method_id=pix → QR Code "copia e cola".
 * - Cartão: Checkout Pro (POST /checkout/preferences) → o cartão é digitado no site do Mercado Pago.
 * - Webhook: valida o header x-signature (HMAC-SHA256 do manifesto id/request-id/ts) com
 *   PAYMENT_WEBHOOK_SECRET e consulta o pagamento na API para obter o status real.
 * Renovações geram nova cobrança (Pix ou link de checkout) enviada por e-mail ao cliente.
 */
@Injectable()
export class MercadoPagoGateway extends PaymentGateway {
  readonly name = 'mercadopago';
  private readonly logger = new Logger(MercadoPagoGateway.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  private get token() {
    return this.config.getOrThrow<string>('MERCADOPAGO_ACCESS_TOKEN');
  }

  private async call(
    path: string,
    init: RequestInit & { idempotencyKey?: string } = {},
  ) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(init.idempotencyKey
          ? { 'X-Idempotency-Key': init.idempotencyKey }
          : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.logger.warn(
        `Mercado Pago ${path} respondeu ${res.status}: ${json?.message ?? ''}`,
      );
      throw new Error(`Mercado Pago respondeu ${res.status}`);
    }
    return json;
  }

  async createCharge(req: ChargeRequest): Promise<ChargeResult> {
    const apiUrl = this.config.get('API_URL') ?? 'http://localhost:3000';
    const frontendUrl =
      this.config.get('FRONTEND_URL') ?? 'http://localhost:5173';
    const notification_url = `${apiUrl}/api/payments/webhook`;
    const amount = Number((req.amountCents / 100).toFixed(2));

    if (req.method === PaymentMethod.PIX) {
      const [firstName, ...rest] = req.payer.name.split(' ');
      const p = await this.call('/v1/payments', {
        method: 'POST',
        idempotencyKey: req.paymentId,
        body: JSON.stringify({
          transaction_amount: amount,
          description: req.description,
          payment_method_id: 'pix',
          external_reference: req.paymentId,
          notification_url,
          payer: {
            email: req.payer.email,
            first_name: firstName,
            last_name: rest.join(' ') || firstName,
            identification: { type: 'CPF', number: req.payer.cpf },
          },
        }),
      });
      return {
        gatewayId: `mp_pay_${p.id}`,
        status: 'PENDENTE',
        pixQrCode: p.point_of_interaction?.transaction_data?.qr_code,
      };
    }

    const back = `${frontendUrl}/pagamento/${req.paymentId}`;
    const pref = await this.call('/checkout/preferences', {
      method: 'POST',
      body: JSON.stringify({
        items: [
          {
            title: req.description,
            quantity: 1,
            unit_price: amount,
            currency_id: 'BRL',
          },
        ],
        payer: { email: req.payer.email },
        external_reference: req.paymentId,
        notification_url,
        back_urls: { success: back, failure: back, pending: back },
        auto_return: 'approved',
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }],
          installments: 1,
        },
      }),
    });
    return {
      gatewayId: `mp_pref_${pref.id}`,
      status: 'PENDENTE',
      checkoutUrl: pref.sandbox_init_point ?? pref.init_point,
    };
  }

  async parseWebhook({
    headers,
    query,
    body,
  }: WebhookInput): Promise<GatewayEvent | null> {
    const type = body?.type ?? query?.type ?? query?.topic;
    const dataId = String(
      (query?.['data.id'] as string) ?? body?.data?.id ?? '',
    );
    if (type !== 'payment' || !dataId) return null;

    this.verifySignature(headers, dataId);

    const p = await this.call(`/v1/payments/${encodeURIComponent(dataId)}`);
    const status =
      p.status === 'approved'
        ? 'APROVADO'
        : p.status === 'rejected'
          ? 'RECUSADO'
          : p.status === 'cancelled' || p.status === 'expired'
            ? 'EXPIRADO'
            : 'PENDENTE';
    if (!p.external_reference) return null;
    return {
      eventId: `mp:${p.id}:${p.status}`,
      paymentId: p.external_reference,
      gatewayId: `mp_pay_${p.id}`,
      status,
      failureReason:
        status === 'RECUSADO' ? `Recusado (${p.status_detail})` : undefined,
    };
  }

  private verifySignature(headers: WebhookInput['headers'], dataId: string) {
    const signature = String(headers['x-signature'] ?? '');
    const requestId = String(headers['x-request-id'] ?? '');
    const parts = Object.fromEntries(
      signature
        .split(',')
        .map((kv) => kv.trim().split('=') as [string, string]),
    );
    if (!parts.ts || !parts.v1)
      throw new InvalidWebhookSignature('Assinatura ausente');
    const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
    const manifest = `id:${id};request-id:${requestId};ts:${parts.ts};`;
    const expected = createHmac(
      'sha256',
      this.config.getOrThrow('PAYMENT_WEBHOOK_SECRET'),
    )
      .update(manifest)
      .digest('hex');
    const a = Buffer.from(parts.v1);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new InvalidWebhookSignature('Assinatura inválida');
    }
  }
}
