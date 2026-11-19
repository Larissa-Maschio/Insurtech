import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  Payment,
  PaymentPurpose,
  PaymentStatus,
  PolicyStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { ClockService } from '../common/clock.service';
import { addDays, addMonths, daysBetween } from '../common/dates';
import { formatBRL } from '../common/money';
import { MailService } from '../mail/mail.service';
import { PaymentHandler, PaymentsService } from '../payments/payments.service';
import { monthlyPrice } from '../pricing/pricing';
import { PrismaService } from '../prisma/prisma.service';

/** Régua de cobrança (RN06 e RN08). */
export const BILLING_RULES = {
  reminderDaysBefore: 5,
  chargeDaysBefore: 3,
  retryOnDays: [3, 7],
  suspendOnDay: 10,
  cancelOnDay: 30,
} as const;

const subInclude = {
  policy: { include: { user: true, device: true, plan: true } },
  pendingPlan: true,
  payments: true,
} satisfies Prisma.SubscriptionInclude;
type SubFull = Prisma.SubscriptionGetPayload<{ include: typeof subInclude }>;

const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });

/**
 * Renovação automática: a rotina diária gera as cobranças, controla inadimplência,
 * suspensão e cancelamento. Também reage aos pagamentos de mensalidade aprovados/recusados.
 */
@Injectable()
export class BillingService implements PaymentHandler, OnModuleInit {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly clock: ClockService,
    private readonly mail: MailService,
  ) {}

  onModuleInit() {
    this.payments.registerHandler(PaymentPurpose.MENSALIDADE, this);
  }

  @Cron('0 3 * * *', {
    name: 'renovacao-diaria',
    timeZone: 'America/Sao_Paulo',
  })
  async cron() {
    const summary = await this.runDaily();
    this.logger.log(`Rotina diária de cobrança: ${JSON.stringify(summary)}`);
  }

  /** Executa a régua para todas as assinaturas vigentes. Idempotente: pode rodar várias vezes no dia. */
  async runDaily() {
    const now = this.clock.now();
    const summary = {
      reminders: 0,
      charges: 0,
      delinquent: 0,
      retries: 0,
      suspended: 0,
      canceled: 0,
    };
    const subs = await this.prisma.subscription.findMany({
      where: {
        status: {
          in: [
            SubscriptionStatus.ATIVA,
            SubscriptionStatus.INADIMPLENTE,
            SubscriptionStatus.SUSPENSA,
          ],
        },
      },
      include: subInclude,
    });

    for (const sub of subs) {
      try {
        await this.processSubscription(sub, now, summary);
      } catch (err) {
        this.logger.error(
          `Falha ao processar assinatura ${sub.id}: ${(err as Error).message}`,
        );
      }
    }
    return summary;
  }

  private async processSubscription(
    sub: SubFull,
    now: Date,
    s: Record<string, number>,
  ) {
    const end = sub.currentPeriodEnd!;
    const user = sub.policy.user;

    if (sub.status === SubscriptionStatus.ATIVA) {
      // Cancelamento agendado: encerra ao fim do ciclo pago (RN09).
      if (sub.cancelAtPeriodEnd) {
        if (now >= end) {
          await this.cancel(
            sub,
            now,
            'Sua assinatura foi encerrada ao fim do período pago, conforme solicitado.',
          );
          s.canceled++;
        }
        return;
      }

      // Aviso de vencimento.
      if (
        now >= addDays(end, -BILLING_RULES.reminderDaysBefore) &&
        sub.reminderSentCycle < sub.cycle
      ) {
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { reminderSentCycle: sub.cycle },
        });
        await this.mail.send(
          user.email,
          'Sua mensalidade vence em breve',
          `<p>Olá, ${user.name}.</p><p>A mensalidade do seguro do seu ${sub.policy.device.brand} ${sub.policy.device.model} vence em ${fmtDate(end)}.</p>`,
          {
            label: 'Ver minha apólice',
            path: `/conta/apolices/${sub.policyId}`,
          },
        );
        s.reminders++;
      }

      // Cobrança do próximo ciclo (uma única vez por ciclo).
      if (
        now >= addDays(end, -BILLING_RULES.chargeDaysBefore) &&
        !this.hasAttempt(sub, sub.cycle + 1, 1)
      ) {
        await this.charge(sub, 1);
        s.charges++;
        // Recarrega: o débito automático pode ter renovado na hora.
        const fresh = await this.prisma.subscription.findUniqueOrThrow({
          where: { id: sub.id },
        });
        if (fresh.cycle > sub.cycle) return;
      }

      // Venceu sem pagamento → inadimplente (dia 0 da RN08).
      if (now >= end) {
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: SubscriptionStatus.INADIMPLENTE,
            delinquentSince: end,
          },
        });
        await this.mail.send(
          user.email,
          'Mensalidade em atraso',
          `<p>Olá, ${user.name}.</p><p>Não identificamos o pagamento da mensalidade que venceu em ${fmtDate(end)}. Regularize em até ${BILLING_RULES.suspendOnDay} dias para não ter a cobertura suspensa.</p>`,
          { label: 'Pagar agora', path: `/conta/apolices/${sub.policyId}` },
        );
        s.delinquent++;
      }
      return;
    }

    // INADIMPLENTE ou SUSPENSA
    const since = sub.delinquentSince ?? end;
    const days = daysBetween(since, now);

    if (days >= BILLING_RULES.cancelOnDay) {
      await this.cancel(
        sub,
        now,
        `Sua apólice foi cancelada por falta de pagamento há mais de ${BILLING_RULES.cancelOnDay} dias.`,
      );
      s.canceled++;
      return;
    }

    if (
      days >= BILLING_RULES.suspendOnDay &&
      sub.status === SubscriptionStatus.INADIMPLENTE
    ) {
      await this.prisma.$transaction([
        this.prisma.subscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.SUSPENSA },
        }),
        this.prisma.policy.update({
          where: { id: sub.policyId },
          data: { status: PolicyStatus.SUSPENSA },
        }),
      ]);
      await this.mail.send(
        user.email,
        'Cobertura suspensa',
        `<p>Olá, ${user.name}.</p><p>Sua cobertura está suspensa por falta de pagamento. Pague a mensalidade em aberto para reativá-la; após ${BILLING_RULES.cancelOnDay} dias de atraso a apólice é cancelada.</p>`,
        { label: 'Regularizar', path: `/conta/apolices/${sub.policyId}` },
      );
      s.suspended++;
    }

    // Novas tentativas nos dias 3 e 7.
    for (const [i, day] of BILLING_RULES.retryOnDays.entries()) {
      const attempt = i + 2;
      if (
        days >= day &&
        !this.hasAttempt(sub, sub.cycle + 1, attempt) &&
        !this.cyclePaid(sub, sub.cycle + 1)
      ) {
        await this.payments.expirePending({
          subscriptionId: sub.id,
          cycle: sub.cycle + 1,
        });
        await this.charge(sub, attempt);
        s.retries++;
        break;
      }
    }
  }

  private hasAttempt(sub: SubFull, cycle: number, attempt: number) {
    return sub.payments.some((p) => p.cycle === cycle && p.attempt >= attempt);
  }

  private cyclePaid(sub: SubFull, cycle: number) {
    return sub.payments.some(
      (p) => p.cycle === cycle && p.status === PaymentStatus.APROVADO,
    );
  }

  private async charge(sub: SubFull, attempt: number) {
    const policy = sub.policy;
    const amount = sub.pendingPlan
      ? monthlyPrice(policy.deviceValueCents, sub.pendingPlan.monthlyRateBps)
      : policy.monthlyPriceCents;
    const cycle = sub.cycle + 1;
    try {
      const payment = await this.payments.createCharge({
        purpose: PaymentPurpose.MENSALIDADE,
        subscriptionId: sub.id,
        cycle,
        attempt,
        amountCents: amount,
        method: sub.method,
        renewal: true,
        description: `Seguro ${sub.pendingPlan?.name ?? policy.plan.name} – ${policy.device.brand} ${policy.device.model} (mensalidade ${cycle})`,
        payer: {
          email: policy.user.email,
          name: policy.user.name,
          cpf: policy.user.cpf,
        },
      });
      if (payment.status === PaymentStatus.PENDENTE) {
        await this.mail.send(
          policy.user.email,
          'Nova cobrança disponível',
          `<p>Olá, ${policy.user.name}.</p><p>A mensalidade ${cycle} do seu seguro (${formatBRL(amount)}) está disponível para pagamento.</p>`,
          { label: 'Pagar mensalidade', path: `/pagamento/${payment.id}` },
        );
      }
    } catch (err) {
      // Unicidade (assinatura, ciclo, tentativa): outra execução já criou esta cobrança.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      )
        return;
      throw err;
    }
  }

  private async cancel(sub: SubFull, now: Date, message: string) {
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.CANCELADA,
          canceledAt: sub.canceledAt ?? now,
        },
      }),
      this.prisma.policy.update({
        where: { id: sub.policyId },
        data: { status: PolicyStatus.CANCELADA },
      }),
    ]);
    await this.payments.expirePending({ subscriptionId: sub.id });
    await this.mail.send(
      sub.policy.user.email,
      'Apólice cancelada',
      `<p>Olá, ${sub.policy.user.name}.</p><p>${message}</p>`,
    );
  }

  // ---------- Reações aos pagamentos de mensalidade ----------

  async onApproved(payment: Payment) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: payment.subscriptionId! },
      include: subInclude,
    });
    if (!sub) return;
    if (payment.cycle !== sub.cycle + 1) {
      this.logger.warn(
        `Pagamento ${payment.id} do ciclo ${payment.cycle} ignorado (ciclo atual ${sub.cycle}).`,
      );
      return;
    }
    if (sub.status === SubscriptionStatus.CANCELADA) {
      this.logger.warn(
        `Pagamento ${payment.id} aprovado para assinatura cancelada: requer estorno manual.`,
      );
      return;
    }

    const now = this.clock.now();
    const isFirst = sub.cycle === 0;

    if (isFirst) {
      // Garante uma única apólice ativa por IMEI (RN04), mesmo com compras concorrentes.
      const other = await this.prisma.policy.findFirst({
        where: {
          id: { not: sub.policyId },
          device: { imei: sub.policy.device.imei },
          status: { in: [PolicyStatus.ATIVA, PolicyStatus.SUSPENSA] },
        },
      });
      if (other) {
        await this.cancel(
          sub,
          now,
          'Este aparelho já possui outro seguro ativo. O pagamento será estornado pelo nosso atendimento.',
        );
        return;
      }
    }

    const start = isFirst ? now : sub.currentPeriodEnd!;
    const end = addMonths(start, 1);
    const planChange = !isFirst && sub.pendingPlanId ? sub.pendingPlan : null;

    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.ATIVA,
          cycle: payment.cycle!,
          currentPeriodStart: start,
          currentPeriodEnd: end,
          nextBillingAt: addDays(end, -BILLING_RULES.chargeDaysBefore),
          delinquentSince: null,
          ...(planChange ? { pendingPlanId: null } : {}),
        },
      }),
      this.prisma.policy.update({
        where: { id: sub.policyId },
        data: {
          status: PolicyStatus.ATIVA,
          startsAt: sub.policy.startsAt ?? start,
          endsAt: end,
          ...(planChange
            ? { planId: planChange.id, monthlyPriceCents: payment.amountCents }
            : {}),
        },
      }),
      this.prisma.payment.updateMany({
        where: {
          subscriptionId: sub.id,
          cycle: payment.cycle,
          status: PaymentStatus.PENDENTE,
        },
        data: { status: PaymentStatus.EXPIRADO },
      }),
    ]);

    const u = sub.policy.user;
    if (isFirst) {
      await this.mail.send(
        u.email,
        `Seguro ativo – apólice ${sub.policy.number}`,
        `<p>Olá, ${u.name}!</p><p>Seu seguro está ativo.</p>
         <ul><li>Aparelho: ${sub.policy.device.brand} ${sub.policy.device.model} (IMEI ${sub.policy.device.imei})</li>
         <li>Plano: ${sub.policy.plan.name}</li><li>Mensalidade: ${formatBRL(payment.amountCents)}</li>
         <li>Vigência atual: ${fmtDate(start)} a ${fmtDate(end)}</li></ul>
         <p>Coberturas de roubo e furto qualificado valem após 7 dias; as demais, após 30 dias.</p>`,
        { label: 'Ver minha apólice', path: `/conta/apolices/${sub.policyId}` },
      );
    } else {
      await this.mail.send(
        u.email,
        'Pagamento confirmado – seguro renovado',
        `<p>Olá, ${u.name}.</p><p>Recebemos o pagamento de ${formatBRL(payment.amountCents)}. Seu seguro está renovado até ${fmtDate(end)}.${planChange ? ` A partir deste ciclo seu plano é o ${planChange.name}.` : ''}</p>`,
      );
    }
  }

  async onFailed(payment: Payment) {
    if (payment.status !== PaymentStatus.RECUSADO) return;
    const sub = await this.prisma.subscription.findUnique({
      where: { id: payment.subscriptionId! },
      include: subInclude,
    });
    if (!sub) return;
    const u = sub.policy.user;
    await this.mail.send(
      u.email,
      'Pagamento recusado',
      `<p>Olá, ${u.name}.</p><p>O pagamento de ${formatBRL(payment.amountCents)} do seu seguro foi recusado${payment.failureReason ? ` (${payment.failureReason})` : ''}. Você pode tentar novamente com outra forma de pagamento.</p>`,
      { label: 'Tentar novamente', path: `/conta/apolices/${sub.policyId}` },
    );
  }
}
