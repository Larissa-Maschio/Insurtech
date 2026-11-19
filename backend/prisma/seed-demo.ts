/**
 * Dados de demonstração (Fase 9): clientes com apólices em estados diferentes, sinistros em
 * andamento, chamados e avaliações publicadas. Rode depois do seed base: npm run db:seed:demo
 * Idempotente: clientes de demonstração já existentes são ignorados.
 */
import {
  ClaimStatus,
  CoverageCode,
  FeedbackStatus,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  PolicyStatus,
  PrismaClient,
  SubscriptionStatus,
  TicketCategory,
  TicketStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { deductible, monthlyPrice } from '../src/pricing/pricing';

const prisma = new PrismaClient();
const DAY = 864e5;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const addMonths = (d: Date, m: number) => {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + m);
  return r;
};
const PASSWORD = 'Cliente@123';

interface DemoPolicy {
  imei: string;
  model: string;
  plan: 'BASICO' | 'INTERMEDIARIO' | 'PREMIUM';
  startedDaysAgo: number;
  cyclesPaid: number;
  policyStatus: PolicyStatus;
  subStatus: SubscriptionStatus;
  delinquentDaysAgo?: number;
}

async function createCustomer(name: string, email: string, cpf: string) {
  return prisma.user.create({
    data: {
      name,
      email,
      cpf,
      phone: '11987654321',
      passwordHash: await argon2.hash(PASSWORD),
      termsAcceptedAt: ago(60),
    },
  });
}

async function createPolicy(userId: string, d: DemoPolicy, n: number) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { code: d.plan } });
  const [brand, ...rest] = d.model.split(' ');
  const model = await prisma.deviceModel.findUniqueOrThrow({
    where: { brand_model: { brand, model: rest.join(' ') } },
  });
  const price = monthlyPrice(model.valueCents, plan.monthlyRateBps);
  const start = ago(d.startedDaysAgo);
  const periodStart = addMonths(start, d.cyclesPaid - 1);
  const periodEnd = addMonths(start, d.cyclesPaid);

  const quote = await prisma.quote.create({
    data: {
      imei: d.imei,
      brand: model.brand,
      model: model.model,
      deviceValueCents: model.valueCents,
      expiresAt: new Date(start.getTime() + 7 * DAY),
      createdAt: start,
      items: { create: [{ planId: plan.id, monthlyPriceCents: price }] },
    },
  });
  const policy = await prisma.policy.create({
    data: {
      number: `AP-DEMO-${String(n).padStart(4, '0')}`,
      user: { connect: { id: userId } },
      plan: { connect: { id: plan.id } },
      quote: { connect: { id: quote.id } },
      status: d.policyStatus,
      monthlyPriceCents: price,
      deviceValueCents: model.valueCents,
      startsAt: start,
      endsAt: periodEnd,
      createdAt: start,
      device: {
        create: {
          imei: d.imei,
          brand: model.brand,
          model: model.model,
          valueCents: model.valueCents,
          ownerId: userId,
        },
      },
      subscription: {
        create: {
          method: PaymentMethod.CARTAO,
          status: d.subStatus,
          cycle: d.cyclesPaid,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextBillingAt: new Date(periodEnd.getTime() - 3 * DAY),
          reminderSentCycle:
            d.subStatus === SubscriptionStatus.ATIVA
              ? d.cyclesPaid - 1
              : d.cyclesPaid,
          delinquentSince:
            d.delinquentDaysAgo !== undefined ? ago(d.delinquentDaysAgo) : null,
        },
      },
    },
    include: {
      subscription: true,
      plan: { include: { coverages: { include: { coverage: true } } } },
    },
  });
  for (let c = 1; c <= d.cyclesPaid; c++) {
    await prisma.payment.create({
      data: {
        purpose: PaymentPurpose.MENSALIDADE,
        subscriptionId: policy.subscription!.id,
        cycle: c,
        amountCents: price,
        method: PaymentMethod.CARTAO,
        status: PaymentStatus.APROVADO,
        gatewayId: `demo_${policy.id}_${c}`,
        paidAt: addMonths(start, c - 1),
        createdAt: addMonths(start, c - 1),
      },
    });
  }
  if (d.subStatus !== SubscriptionStatus.ATIVA) {
    await prisma.payment.create({
      data: {
        purpose: PaymentPurpose.MENSALIDADE,
        subscriptionId: policy.subscription!.id,
        cycle: d.cyclesPaid + 1,
        amountCents: price,
        method: PaymentMethod.CARTAO,
        status: PaymentStatus.RECUSADO,
        failureReason: 'Cartão recusado pelo emissor (demonstração)',
        createdAt: new Date(periodEnd.getTime() - 3 * DAY),
      },
    });
  }
  return policy;
}

async function createClaim(
  policy: Awaited<ReturnType<typeof createPolicy>>,
  userId: string,
  adminId: string,
  type: CoverageCode,
  flow: ClaimStatus[],
  n: number,
  decisionReason?: string,
) {
  const pc = policy.plan.coverages.find((c) => c.coverage.code === type)!;
  const opened = ago(3);
  const claim = await prisma.claim.create({
    data: {
      number: `SN-DEMO-${String(n).padStart(4, '0')}`,
      policyId: policy.id,
      userId,
      type,
      occurredAt: ago(4),
      location: 'Rua Augusta, 500 – São Paulo/SP',
      description:
        type === CoverageCode.QUEBRA_ACIDENTAL
          ? 'O celular escorregou da mão ao descer do ônibus e a tela trincou inteira.'
          : 'Fui abordado na saída do metrô por duas pessoas que levaram o aparelho.',
      status: flow[flow.length - 1],
      deductibleCents: deductible(policy.deviceValueCents, pc.deductibleBps),
      decisionReason,
      createdAt: opened,
    },
  });
  const notes: Partial<Record<ClaimStatus, string>> = {
    ABERTO: 'Sinistro aberto pelo cliente',
    EM_ANALISE: 'Análise iniciada',
    NEGADO: decisionReason,
    APROVADO: decisionReason,
    AGUARDANDO_FRANQUIA: 'Franquia disponível para pagamento',
  };
  let prev: ClaimStatus | null = null;
  for (const [i, s] of flow.entries()) {
    await prisma.claimEvent.create({
      data: {
        claimId: claim.id,
        fromStatus: prev,
        toStatus: s,
        actorId:
          s === ClaimStatus.ABERTO
            ? userId
            : s === ClaimStatus.AGUARDANDO_FRANQUIA
              ? null
              : adminId,
        note: notes[s],
        createdAt: new Date(opened.getTime() + i * 3600e3),
      },
    });
    prev = s;
  }
}

async function main() {
  if (await prisma.user.findUnique({ where: { email: 'ana@demo.local' } })) {
    console.log('Dados de demonstração já existem. Nada a fazer.');
    return;
  }
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@seguradora.local' },
  });

  // Ana: apólice ativa e em dia, com sinistro em análise e chamado aberto.
  const ana = await createCustomer(
    'Ana Beatriz Demo',
    'ana@demo.local',
    '39053344705',
  );
  const anaPolicy = await createPolicy(
    ana.id,
    {
      imei: '350000019000013',
      model: 'Apple iPhone 16',
      plan: 'PREMIUM',
      startedDaysAgo: 45,
      cyclesPaid: 2,
      policyStatus: PolicyStatus.ATIVA,
      subStatus: SubscriptionStatus.ATIVA,
    },
    1,
  );
  await createClaim(
    anaPolicy,
    ana.id,
    admin.id,
    CoverageCode.QUEBRA_ACIDENTAL,
    [ClaimStatus.ABERTO, ClaimStatus.EM_ANALISE],
    1,
  );
  await prisma.ticket.create({
    data: {
      userId: ana.id,
      policyId: anaPolicy.id,
      subject: 'Prazo para o reparo da tela',
      category: TicketCategory.SINISTRO,
      messages: {
        create: [
          {
            authorId: ana.id,
            body: 'Olá! Depois de aprovado, em quanto tempo o reparo fica pronto?',
          },
        ],
      },
    },
  });

  // Bruno: mensalidade em atraso (inadimplente há 4 dias) e sinistro aguardando franquia.
  const bruno = await createCustomer(
    'Bruno Carvalho Demo',
    'bruno@demo.local',
    '15350946056',
  );
  const brunoPolicy = await createPolicy(
    bruno.id,
    {
      imei: '350000049000017',
      model: 'Samsung Galaxy S25',
      plan: 'INTERMEDIARIO',
      startedDaysAgo: 65,
      cyclesPaid: 2,
      policyStatus: PolicyStatus.ATIVA,
      subStatus: SubscriptionStatus.INADIMPLENTE,
      delinquentDaysAgo: 4,
    },
    2,
  );
  await createClaim(
    brunoPolicy,
    bruno.id,
    admin.id,
    CoverageCode.ROUBO,
    [
      ClaimStatus.ABERTO,
      ClaimStatus.EM_ANALISE,
      ClaimStatus.APROVADO,
      ClaimStatus.AGUARDANDO_FRANQUIA,
    ],
    2,
    'Boletim de ocorrência e documentos conferidos.',
  );
  await prisma.ticket.create({
    data: {
      userId: bruno.id,
      subject: 'Troca do cartão de crédito',
      category: TicketCategory.PAGAMENTO,
      status: TicketStatus.RESOLVIDO,
      messages: {
        create: [
          {
            authorId: bruno.id,
            body: 'Meu cartão venceu. Como pago a mensalidade em atraso?',
          },
          {
            authorId: admin.id,
            body: 'Na sua apólice, em "Pagar mensalidade", escolha Pix ou um novo cartão.',
          },
        ],
      },
    },
  });

  // Carla: cobertura suspensa (12 dias de atraso) e sinistro negado.
  const carla = await createCustomer(
    'Carla Mendes Demo',
    'carla@demo.local',
    '71428793860',
  );
  const carlaPolicy = await createPolicy(
    carla.id,
    {
      imei: '350000069000012',
      model: 'Motorola Moto G85',
      plan: 'BASICO',
      startedDaysAgo: 75,
      cyclesPaid: 2,
      policyStatus: PolicyStatus.SUSPENSA,
      subStatus: SubscriptionStatus.SUSPENSA,
      delinquentDaysAgo: 12,
    },
    3,
  );
  await createClaim(
    carlaPolicy,
    carla.id,
    admin.id,
    CoverageCode.ROUBO,
    [ClaimStatus.ABERTO, ClaimStatus.EM_ANALISE, ClaimStatus.NEGADO],
    3,
    'O boletim de ocorrência enviado é de data anterior ao início da apólice.',
  );

  // Avaliações publicadas na landing page.
  const fb: [string, number, string, FeedbackStatus][] = [
    [
      ana.id,
      5,
      'Contratei em 3 minutos pelo celular. Muito prático!',
      FeedbackStatus.APROVADO,
    ],
    [
      bruno.id,
      4,
      'Atendimento rápido para resolver minha dúvida de pagamento.',
      FeedbackStatus.APROVADO,
    ],
    [
      carla.id,
      3,
      'Gostaria que a análise fosse mais rápida.',
      FeedbackStatus.PENDENTE,
    ],
  ];
  for (const [userId, rating, comment, status] of fb)
    await prisma.feedback.create({ data: { userId, rating, comment, status } });

  console.log(
    `Dados de demonstração criados. Clientes (senha ${PASSWORD}): ana@demo.local, bruno@demo.local, carla@demo.local`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
