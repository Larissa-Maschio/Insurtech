import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  Payment,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { AuthUser } from '../auth/decorators';
import { AppException, forbidden, notFound } from '../common/app-exception';
import { ClockService } from '../common/clock.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChargeRequest,
  GatewayEvent,
  InvalidWebhookSignature,
  PaymentGateway,
  WebhookInput,
} from './gateway/payment-gateway';

/** Reações de outros módulos a um pagamento finalizado (evita dependência circular). */
export interface PaymentHandler {
  onApproved(payment: Payment): Promise<void>;
  onFailed(payment: Payment): Promise<void>;
}

export interface NewCharge {
  purpose: PaymentPurpose;
  amountCents: number;
  method: PaymentMethod;
  description: string;
  payer: ChargeRequest['payer'];
  subscriptionId?: string;
  claimId?: string;
  cycle?: number;
  attempt?: number;
  renewal?: boolean;
}

export function serializePayment(p: Payment) {
  return {
    id: p.id,
    purpose: p.purpose,
    cycle: p.cycle,
    attempt: p.attempt,
    amountCents: p.amountCents,
    method: p.method,
    status: p.status,
    pixQrCode: p.status === PaymentStatus.PENDENTE ? p.pixQrCode : null,
    checkoutUrl: p.status === PaymentStatus.PENDENTE ? p.checkoutUrl : null,
    failureReason: p.failureReason,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly handlers = new Map<PaymentPurpose, PaymentHandler>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGateway,
    private readonly clock: ClockService,
  ) {}

  registerHandler(purpose: PaymentPurpose, handler: PaymentHandler) {
    this.handlers.set(purpose, handler);
  }

  /**
   * Cria o registro do pagamento e a cobrança no gateway.
   * A unicidade (assinatura, ciclo, tentativa) no banco impede cobrar duas vezes o mesmo ciclo.
   */
  async createCharge(c: NewCharge): Promise<Payment> {
    const payment = await this.prisma.payment.create({
      data: {
        purpose: c.purpose,
        amountCents: c.amountCents,
        method: c.method,
        subscriptionId: c.subscriptionId,
        claimId: c.claimId,
        cycle: c.cycle,
        attempt: c.attempt ?? 1,
      },
    });

    let result;
    try {
      result = await this.gateway.createCharge({
        paymentId: payment.id,
        amountCents: c.amountCents,
        method: c.method,
        description: c.description,
        payer: c.payer,
        renewal: c.renewal,
      });
    } catch (err) {
      this.logger.error(
        `Falha ao criar cobrança no gateway: ${(err as Error).message}`,
      );
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.RECUSADO,
          failureReason: 'Gateway indisponível',
        },
      });
      throw new AppException(
        'GATEWAY_INDISPONIVEL',
        'Não foi possível iniciar o pagamento agora. Tente novamente em instantes.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        gatewayId: result.gatewayId,
        pixQrCode: result.pixQrCode,
        checkoutUrl: result.checkoutUrl,
      },
    });

    // Débito automático com resposta imediata (mock): processa como se fosse o webhook.
    if (result.status !== 'PENDENTE') {
      await this.applyEvent({
        eventId: `sync:${payment.id}`,
        paymentId: payment.id,
        gatewayId: result.gatewayId,
        status: result.status,
        failureReason: result.failureReason,
      });
      return this.prisma.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });
    }
    return updated;
  }

  /** Entrada do webhook: valida assinatura e aplica o evento. */
  async handleWebhook(input: WebhookInput) {
    let event: GatewayEvent | null;
    try {
      event = await this.gateway.parseWebhook(input);
    } catch (err) {
      if (err instanceof InvalidWebhookSignature) {
        throw new AppException(
          'ASSINATURA_INVALIDA',
          'Assinatura do webhook inválida.',
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw err;
    }
    if (!event) return { processed: false, reason: 'ignorado' };
    return this.applyEvent(event);
  }

  /**
   * Aplica um evento de forma idempotente: a troca de status só acontece se o pagamento ainda
   * estiver PENDENTE (update condicional), então eventos repetidos ou concorrentes não duplicam efeito.
   */
  async applyEvent(event: GatewayEvent) {
    const seen = await this.prisma.webhookEvent.findUnique({
      where: { id: event.eventId },
    });
    if (seen) return { processed: false, reason: 'duplicado' };

    if (event.status === 'PENDENTE')
      return { processed: false, reason: 'pendente' };

    const now = this.clock.now();
    const newStatus = PaymentStatus[event.status];
    const { count } = await this.prisma.payment.updateMany({
      where: { id: event.paymentId, status: PaymentStatus.PENDENTE },
      data: {
        status: newStatus,
        paidAt: newStatus === PaymentStatus.APROVADO ? now : null,
        failureReason: event.failureReason ?? null,
        ...(event.gatewayId ? { gatewayId: event.gatewayId } : {}),
      },
    });

    try {
      await this.prisma.webhookEvent.create({
        data: { id: event.eventId, type: event.status },
      });
    } catch (err) {
      if (!(
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ))
        throw err;
    }
    if (count === 0) return { processed: false, reason: 'ja_finalizado' };

    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: event.paymentId },
    });
    const handler = this.handlers.get(payment.purpose);
    if (handler) {
      if (payment.status === PaymentStatus.APROVADO)
        await handler.onApproved(payment);
      else await handler.onFailed(payment);
    }
    return { processed: true, status: payment.status };
  }

  /** Expira cobranças pendentes (ex.: Pix antigo ao gerar nova tentativa). */
  async expirePending(where: Prisma.PaymentWhereInput) {
    await this.prisma.payment.updateMany({
      where: { ...where, status: PaymentStatus.PENDENTE },
      data: { status: PaymentStatus.EXPIRADO },
    });
  }

  async getForUser(id: string, user: AuthUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        subscription: { include: { policy: true } },
        claim: true,
      },
    });
    if (!payment) throw notFound('Pagamento');
    const ownerId =
      payment.subscription?.policy.userId ?? payment.claim?.userId;
    if (user.role !== Role.ADMIN && ownerId !== user.id) throw forbidden();
    return {
      ...serializePayment(payment),
      policyId: payment.subscription?.policyId ?? null,
      claimId: payment.claimId,
    };
  }
}
