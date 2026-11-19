import { HttpStatus, Injectable } from '@nestjs/common';
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  PolicyStatus,
  Prisma,
  Role,
  SubscriptionStatus,
} from '@prisma/client';
import { AuthUser } from '../auth/decorators';
import { AppException, forbidden, notFound } from '../common/app-exception';
import { ClockService } from '../common/clock.service';
import { humanCode } from '../common/codes';
import { addDays } from '../common/dates';
import {
  PaymentsService,
  serializePayment,
} from '../payments/payments.service';
import { PLAN_INCLUDE } from '../plans/plans.service';
import { deductible, monthlyPrice } from '../pricing/pricing';
import { PrismaService } from '../prisma/prisma.service';
import {
  BLOCKING_POLICY_STATUSES,
  QuotesService,
} from '../quotes/quotes.service';

export const policyInclude = {
  device: true,
  plan: { include: PLAN_INCLUDE },
  subscription: {
    include: {
      payments: { orderBy: { createdAt: 'desc' as const } },
      pendingPlan: true,
    },
  },
} satisfies Prisma.PolicyInclude;

export type PolicyFull = Prisma.PolicyGetPayload<{
  include: typeof policyInclude;
}>;

@Injectable()
export class PoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
    private readonly payments: PaymentsService,
    private readonly clock: ClockService,
  ) {}

  /** Compra: cotação válida → apólice aguardando pagamento + assinatura + primeira cobrança. */
  async purchase(
    user: AuthUser,
    quoteId: string,
    planId: string,
    method: PaymentMethod,
  ) {
    const { quote, item } = await this.quotes.getValidItem(quoteId, planId);

    const busy = await this.prisma.policy.findFirst({
      where: {
        device: { imei: quote.imei },
        status: { in: BLOCKING_POLICY_STATUSES },
      },
    });
    if (busy)
      throw new AppException(
        'APOLICE_EXISTENTE',
        'Este aparelho já possui um seguro ativo.',
        HttpStatus.CONFLICT,
      );

    // Uma compra nova substitui tentativas anteriores não pagas do mesmo cliente para o mesmo IMEI.
    const stale = await this.prisma.policy.findMany({
      where: {
        userId: user.id,
        status: PolicyStatus.AGUARDANDO_PAGAMENTO,
        device: { imei: quote.imei },
      },
      include: { subscription: true },
    });
    for (const p of stale) {
      await this.prisma.policy.update({
        where: { id: p.id },
        data: { status: PolicyStatus.CANCELADA },
      });
      if (p.subscription) {
        await this.prisma.subscription.update({
          where: { id: p.subscription.id },
          data: {
            status: SubscriptionStatus.CANCELADA,
            canceledAt: this.clock.now(),
          },
        });
        await this.payments.expirePending({
          subscriptionId: p.subscription.id,
        });
      }
    }

    const dbUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    const policy = await this.prisma.policy.create({
      data: {
        number: humanCode('AP', this.clock.now()),
        user: { connect: { id: user.id } },
        quote: { connect: { id: quote.id } },
        plan: { connect: { id: item.planId } },
        monthlyPriceCents: item.monthlyPriceCents,
        deviceValueCents: quote.deviceValueCents,
        device: {
          create: {
            imei: quote.imei,
            brand: quote.brand,
            model: quote.model,
            valueCents: quote.deviceValueCents,
            ownerId: user.id,
          },
        },
        subscription: { create: { method } },
      },
      include: { subscription: true, plan: true },
    });

    const payment = await this.payments.createCharge({
      purpose: PaymentPurpose.MENSALIDADE,
      subscriptionId: policy.subscription!.id,
      cycle: 1,
      attempt: 1,
      amountCents: item.monthlyPriceCents,
      method,
      description: `Seguro ${policy.plan.name} – ${quote.brand} ${quote.model} (1ª mensalidade)`,
      payer: { email: dbUser.email, name: dbUser.name, cpf: dbUser.cpf },
    });

    return {
      policyId: policy.id,
      policyNumber: policy.number,
      payment: serializePayment(payment),
    };
  }

  /** Nova tentativa de pagamento para a mensalidade em aberto (1ª ou renovação atrasada). */
  async payPending(user: AuthUser, policyId: string, method: PaymentMethod) {
    const policy = await this.findOwned(policyId, user);
    const sub = policy.subscription;
    if (!sub || sub.status === SubscriptionStatus.CANCELADA) {
      throw new AppException(
        'SEM_COBRANCA_ABERTA',
        'Não há cobrança em aberto para esta apólice.',
      );
    }
    const cycle = sub.cycle + 1;
    const now = this.clock.now();
    const isFirst = sub.cycle === 0;
    const isDue =
      isFirst ||
      sub.status !== SubscriptionStatus.ATIVA ||
      (sub.currentPeriodEnd && now >= addDays(sub.currentPeriodEnd, -3));
    if (!isDue || sub.cancelAtPeriodEnd) {
      throw new AppException(
        'SEM_COBRANCA_ABERTA',
        'Não há cobrança em aberto para esta apólice.',
      );
    }
    if (
      sub.payments.some(
        (p) => p.cycle === cycle && p.status === PaymentStatus.APROVADO,
      )
    ) {
      throw new AppException(
        'JA_PAGO',
        'Esta mensalidade já foi paga.',
        HttpStatus.CONFLICT,
      );
    }

    const attempts = sub.payments
      .filter((p) => p.cycle === cycle)
      .map((p) => p.attempt);
    await this.payments.expirePending({ subscriptionId: sub.id, cycle });
    const dbUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: policy.userId },
    });
    const amount = this.renewalAmount(policy);

    if (method !== sub.method) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { method },
      });
    }
    const payment = await this.payments.createCharge({
      purpose: PaymentPurpose.MENSALIDADE,
      subscriptionId: sub.id,
      cycle,
      attempt: Math.max(0, ...attempts) + 1,
      amountCents: amount,
      method,
      description: `Seguro ${policy.plan.name} – ${policy.device.brand} ${policy.device.model} (mensalidade ${cycle})`,
      payer: { email: dbUser.email, name: dbUser.name, cpf: dbUser.cpf },
    });
    return serializePayment(payment);
  }

  /** Valor da próxima mensalidade, já considerando troca de plano agendada. */
  renewalAmount(policy: PolicyFull) {
    const pending = policy.subscription?.pendingPlan;
    return pending
      ? monthlyPrice(policy.deviceValueCents, pending.monthlyRateBps)
      : policy.monthlyPriceCents;
  }

  async list(user: AuthUser) {
    const policies = await this.prisma.policy.findMany({
      where: {
        userId: user.id,
        NOT: { status: PolicyStatus.CANCELADA, startsAt: null },
      },
      include: policyInclude,
      orderBy: { createdAt: 'desc' },
    });
    return policies.map((p) => this.serialize(p));
  }

  async get(id: string, user: AuthUser) {
    return this.serialize(await this.findOwned(id, user));
  }

  async findOwned(id: string, user: AuthUser): Promise<PolicyFull> {
    const policy = await this.prisma.policy.findUnique({
      where: { id },
      include: policyInclude,
    });
    if (!policy) throw notFound('Apólice');
    if (user.role !== Role.ADMIN && policy.userId !== user.id)
      throw forbidden();
    return policy;
  }

  serialize(p: PolicyFull) {
    const sub = p.subscription;
    const now = this.clock.now();
    const nextCycle = (sub?.cycle ?? 0) + 1;
    const openPayment = sub?.payments.find(
      (x) => x.cycle === nextCycle && x.status === PaymentStatus.PENDENTE,
    );
    return {
      id: p.id,
      number: p.number,
      status: p.status,
      device: {
        imei: p.device.imei,
        brand: p.device.brand,
        model: p.device.model,
        valueCents: p.device.valueCents,
      },
      plan: { id: p.plan.id, code: p.plan.code, name: p.plan.name },
      monthlyPriceCents: p.monthlyPriceCents,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      createdAt: p.createdAt,
      coverages: p.plan.coverages.map((pc) => {
        const graceEndsAt = p.startsAt
          ? addDays(p.startsAt, pc.coverage.gracePeriodDays)
          : null;
        return {
          code: pc.coverage.code,
          name: pc.coverage.name,
          description: pc.coverage.description,
          deductibleBps: pc.deductibleBps,
          deductibleCents: deductible(p.deviceValueCents, pc.deductibleBps),
          gracePeriodDays: pc.coverage.gracePeriodDays,
          graceEndsAt,
          inGracePeriod: !graceEndsAt || graceEndsAt > now,
        };
      }),
      subscription: sub
        ? {
            id: sub.id,
            status: sub.status,
            method: sub.method,
            cycle: sub.cycle,
            currentPeriodStart: sub.currentPeriodStart,
            currentPeriodEnd: sub.currentPeriodEnd,
            nextBillingAt:
              sub.status === SubscriptionStatus.CANCELADA ||
              sub.cancelAtPeriodEnd
                ? null
                : sub.nextBillingAt,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            canceledAt: sub.canceledAt,
            delinquentSince: sub.delinquentSince,
            pendingPlan: sub.pendingPlan
              ? { id: sub.pendingPlan.id, name: sub.pendingPlan.name }
              : null,
            openPayment: openPayment ? serializePayment(openPayment) : null,
            payments: sub.payments.map(serializePayment),
          }
        : null,
    };
  }
}
