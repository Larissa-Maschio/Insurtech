import { HttpStatus, Injectable } from '@nestjs/common';
import { PolicyStatus, Role, SubscriptionStatus } from '@prisma/client';
import { AuthUser } from '../auth/decorators';
import { AppException, forbidden, notFound } from '../common/app-exception';
import { ClockService } from '../common/clock.service';
import { addDays } from '../common/dates';
import { MailService } from '../mail/mail.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { BILLING_RULES } from './billing.service';
import { policyInclude, PoliciesService } from './policies.service';

const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: PoliciesService,
    private readonly payments: PaymentsService,
    private readonly clock: ClockService,
    private readonly mail: MailService,
  ) {}

  async list(user: AuthUser) {
    const subs = await this.prisma.subscription.findMany({
      where: {
        policy: { userId: user.id },
        NOT: { status: SubscriptionStatus.CANCELADA, cycle: 0 },
      },
      include: { policy: { include: policyInclude } },
      orderBy: { createdAt: 'desc' },
    });
    return subs.map((s) => this.serialize(s.policy));
  }

  async get(id: string, user: AuthUser) {
    return this.serialize(await this.findOwnedPolicy(id, user));
  }

  /** Cancelamento pelo cliente (RN09): cobertura até o fim do ciclo pago, sem reembolso. */
  async cancel(id: string, user: AuthUser) {
    const policy = await this.findOwnedPolicy(id, user);
    const sub = policy.subscription!;
    const now = this.clock.now();

    if (sub.status === SubscriptionStatus.CANCELADA || sub.cancelAtPeriodEnd) {
      throw new AppException(
        'JA_CANCELADA',
        'Esta assinatura já foi cancelada.',
        HttpStatus.CONFLICT,
      );
    }

    if (sub.status === SubscriptionStatus.ATIVA) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { cancelAtPeriodEnd: true, canceledAt: now, pendingPlanId: null },
      });
      await this.payments.expirePending({
        subscriptionId: sub.id,
        cycle: sub.cycle + 1,
      });
      await this.mail.send(
        policy.user?.email ?? user.email,
        'Cancelamento confirmado',
        `<p>Recebemos seu pedido de cancelamento. Sua cobertura continua valendo até ${fmtDate(sub.currentPeriodEnd!)} e não haverá novas cobranças.</p>`,
      );
    } else {
      // Pendente, inadimplente ou suspensa: não há período pago em curso, cancela na hora.
      await this.prisma.$transaction([
        this.prisma.subscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.CANCELADA, canceledAt: now },
        }),
        this.prisma.policy.update({
          where: { id: policy.id },
          data: { status: PolicyStatus.CANCELADA },
        }),
      ]);
      await this.payments.expirePending({ subscriptionId: sub.id });
      await this.mail.send(
        user.email,
        'Cancelamento confirmado',
        '<p>Sua apólice foi cancelada.</p>',
      );
    }
    return this.get(id, user);
  }

  /** Troca de plano a partir do próximo ciclo (US15). Escolher o plano atual desfaz a troca agendada. */
  async changePlan(id: string, user: AuthUser, planId: string) {
    const policy = await this.findOwnedPolicy(id, user);
    const sub = policy.subscription!;
    if (sub.status !== SubscriptionStatus.ATIVA || sub.cancelAtPeriodEnd) {
      throw new AppException(
        'TROCA_INDISPONIVEL',
        'A troca de plano só é possível com a assinatura ativa.',
      );
    }
    const plan = await this.prisma.plan.findFirst({
      where: { OR: [{ id: planId }, { code: planId }], active: true },
    });
    if (!plan) throw notFound('Plano');
    const chargeDate = addDays(
      sub.currentPeriodEnd!,
      -BILLING_RULES.chargeDaysBefore,
    );
    if (plan.id !== policy.planId && this.clock.now() >= chargeDate) {
      throw new AppException(
        'TROCA_FORA_DO_PRAZO',
        'A cobrança do próximo ciclo já foi gerada. Faça a troca depois da renovação.',
      );
    }
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { pendingPlanId: plan.id === policy.planId ? null : plan.id },
    });
    return this.get(id, user);
  }

  private async findOwnedPolicy(subscriptionId: string, user: AuthUser) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { policy: { include: { ...policyInclude, user: true } } },
    });
    if (!sub) throw notFound('Assinatura');
    if (user.role !== Role.ADMIN && sub.policy.userId !== user.id)
      throw forbidden();
    return sub.policy;
  }

  private serialize(policy: Parameters<PoliciesService['serialize']>[0]) {
    const p = this.policies.serialize(policy);
    return {
      ...p.subscription!,
      policy: {
        id: p.id,
        number: p.number,
        status: p.status,
        device: p.device,
        plan: p.plan,
        monthlyPriceCents: p.monthlyPriceCents,
      },
    };
  }
}
