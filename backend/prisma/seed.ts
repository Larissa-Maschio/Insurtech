/**
 * Seed base (idempotente): planos, coberturas, plano×cobertura, tabela de modelos,
 * perguntas frequentes e um administrador de teste. Valores de docs/regras-de-negocio.md.
 * Uso: npm run db:seed
 */
import { CoverageCode, PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const COVERAGES: {
  code: CoverageCode;
  name: string;
  description: string;
  grace: number;
}[] = [
  {
    code: 'ROUBO',
    name: 'Roubo',
    description: 'Subtração do aparelho com violência ou grave ameaça.',
    grace: 7,
  },
  {
    code: 'FURTO_QUALIFICADO',
    name: 'Furto qualificado',
    description: 'Subtração com vestígios, como arrombamento.',
    grace: 7,
  },
  {
    code: 'QUEBRA_ACIDENTAL',
    name: 'Quebra acidental',
    description: 'Danos acidentais à tela e ao corpo do aparelho.',
    grace: 30,
  },
  {
    code: 'DANO_LIQUIDO',
    name: 'Dano por líquido',
    description: 'Danos causados por contato acidental com líquidos.',
    grace: 30,
  },
  {
    code: 'FURTO_SIMPLES',
    name: 'Furto simples',
    description: 'Subtração sem violência e sem vestígios.',
    grace: 30,
  },
];

// deductibleBps por cobertura (RN03); ausência = cobertura não incluída (RN01).
const PLANS = [
  {
    code: 'BASICO',
    name: 'Básico',
    description: 'Proteção essencial contra roubo e furto qualificado.',
    monthlyRateBps: 90,
    sortOrder: 1,
    coverages: { ROUBO: 2500, FURTO_QUALIFICADO: 2500 },
  },
  {
    code: 'INTERMEDIARIO',
    name: 'Intermediário',
    description: 'Roubo, furto qualificado e quebra acidental de tela e corpo.',
    monthlyRateBps: 130,
    sortOrder: 2,
    coverages: { ROUBO: 2000, FURTO_QUALIFICADO: 2000, QUEBRA_ACIDENTAL: 2000 },
  },
  {
    code: 'PREMIUM',
    name: 'Premium',
    description:
      'Cobertura completa, incluindo dano por líquido e furto simples.',
    monthlyRateBps: 180,
    sortOrder: 3,
    coverages: {
      ROUBO: 1500,
      FURTO_QUALIFICADO: 1500,
      QUEBRA_ACIDENTAL: 1500,
      DANO_LIQUIDO: 2000,
      FURTO_SIMPLES: 3000,
    },
  },
] as const;

// Tabela de referência de modelos e valores (RN04). Inclui casos fora das regras, para testes.
const DEVICE_MODELS = [
  {
    brand: 'Apple',
    model: 'iPhone 17 Pro Max',
    releaseYear: 2025,
    valueCents: 1_199_900,
  },
  {
    brand: 'Apple',
    model: 'iPhone 16',
    releaseYear: 2024,
    valueCents: 649_900,
  },
  {
    brand: 'Apple',
    model: 'iPhone 15',
    releaseYear: 2023,
    valueCents: 479_900,
  },
  {
    brand: 'Samsung',
    model: 'Galaxy S25',
    releaseYear: 2025,
    valueCents: 549_900,
  },
  {
    brand: 'Samsung',
    model: 'Galaxy A55',
    releaseYear: 2024,
    valueCents: 219_900,
  },
  {
    brand: 'Samsung',
    model: 'Galaxy Z Fold7',
    releaseYear: 2025,
    valueCents: 1_599_900,
  },
  {
    brand: 'Samsung',
    model: 'Galaxy S9',
    releaseYear: 2018,
    valueCents: 120_000,
  },
  {
    brand: 'Motorola',
    model: 'Moto G85',
    releaseYear: 2024,
    valueCents: 159_900,
  },
  {
    brand: 'Motorola',
    model: 'Moto E14',
    releaseYear: 2024,
    valueCents: 59_900,
  },
  {
    brand: 'Xiaomi',
    model: 'Redmi Note 14',
    releaseYear: 2025,
    valueCents: 149_900,
  },
];

const FAQS = [
  [
    'Como descubro o IMEI do meu celular?',
    'Disque *#06# no seu celular: o IMEI aparece na tela. Ele também está nas configurações (Sobre o telefone) e na caixa do aparelho. Use o IMEI 1 se o aparelho tiver dois chips.',
  ],
  [
    'Quais aparelhos posso segurar?',
    'Smartphones com valor de referência entre R$ 800 e R$ 15.000, lançados há no máximo 3 anos e sem bloqueio por roubo ou perda.',
  ],
  [
    'Quando a cobertura começa a valer?',
    'A apólice começa quando o pagamento é confirmado. Há carência de 7 dias para roubo e furto qualificado e de 30 dias para as demais coberturas.',
  ],
  [
    'O que é a franquia?',
    'É a parte do prejuízo paga por você quando o sinistro é aprovado. O valor é um percentual do valor do aparelho e aparece na cotação e na sua apólice.',
  ],
  [
    'Como funciona a cobrança?',
    'A assinatura é mensal e renovada automaticamente. Avisamos por e-mail antes de cada vencimento.',
  ],
  [
    'O que acontece se eu atrasar o pagamento?',
    'Tentamos cobrar novamente nos dias 3 e 7. Com 10 dias de atraso a cobertura é suspensa e, com 30 dias, a apólice é cancelada.',
  ],
  [
    'Posso cancelar quando quiser?',
    'Sim, pela área do cliente. A cobertura continua até o fim do mês já pago e não há multa.',
  ],
  [
    'Como aciono o seguro?',
    'Na área do cliente, em Sinistros, informe o que aconteceu e envie os documentos. Você acompanha a análise pela linha do tempo.',
  ],
  [
    'Quais documentos preciso enviar?',
    'Para roubo e furto: boletim de ocorrência e documento com foto. Para quebra ou dano por líquido: pelo menos duas fotos do aparelho.',
  ],
];

async function main() {
  for (const c of COVERAGES) {
    await prisma.coverage.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        name: c.name,
        description: c.description,
        gracePeriodDays: c.grace,
      },
      update: {
        name: c.name,
        description: c.description,
        gracePeriodDays: c.grace,
      },
    });
  }
  const coverageIds = Object.fromEntries(
    (await prisma.coverage.findMany()).map((c) => [c.code, c.id]),
  );

  for (const p of PLANS) {
    const plan = await prisma.plan.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        name: p.name,
        description: p.description,
        monthlyRateBps: p.monthlyRateBps,
        sortOrder: p.sortOrder,
      },
      update: {
        name: p.name,
        description: p.description,
        monthlyRateBps: p.monthlyRateBps,
        sortOrder: p.sortOrder,
      },
    });
    await prisma.planCoverage.deleteMany({ where: { planId: plan.id } });
    await prisma.planCoverage.createMany({
      data: Object.entries(p.coverages).map(([code, bps]) => ({
        planId: plan.id,
        coverageId: coverageIds[code],
        deductibleBps: bps,
      })),
    });
  }

  for (const m of DEVICE_MODELS) {
    await prisma.deviceModel.upsert({
      where: { brand_model: { brand: m.brand, model: m.model } },
      create: m,
      update: { releaseYear: m.releaseYear, valueCents: m.valueCents },
    });
  }

  if ((await prisma.faq.count()) === 0) {
    await prisma.faq.createMany({
      data: FAQS.map(([question, answer], i) => ({
        question,
        answer,
        sortOrder: i + 1,
      })),
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@seguradora.local';
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      name: 'Atendimento Seguradora',
      email: adminEmail,
      cpf: '11144477735',
      phone: '11900000000',
      role: Role.ADMIN,
      passwordHash: await argon2.hash(
        process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345',
      ),
      termsAcceptedAt: new Date(),
    },
    update: {},
  });

  console.log(
    'Seed base aplicado: 3 planos, 5 coberturas, %d modelos, FAQ e admin (%s).',
    DEVICE_MODELS.length,
    adminEmail,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
