import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ClockService } from '../src/common/clock.service';
import { BillingService } from '../src/insurance/billing.service';
import { MailService } from '../src/mail/mail.service';
import { MockPaymentGateway } from '../src/payments/gateway/mock.gateway';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

/** IMEIs válidos do MockImeiProvider (ver scripts/test-imeis.ts). */
export const IMEI = {
  iphone16: '350000011234560',
  iphone15: '350000021234568',
  galaxyS25: '350000041234564',
  galaxyA55: '350000051234561',
  motoG85: '350000061234569',
  galaxyS9_old: '350000081234565',
  motoE14_cheap: '350000091234563',
  fold7_expensive: '350000101234561',
  nokia_unknown: '350000201234560',
  blocked: '359999991234568',
  unavailable: '350000001234562',
};

/** Gera IMEI válido e único (serial variável) para um TAC do mock. */
export function uniqueImei(tac = '35000004'): string {
  const serial = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  const base = tac + serial;
  for (let d = 0; d <= 9; d++) {
    const imei = base + d;
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      let x = Number(imei[14 - i]);
      if (i % 2 === 1) {
        x *= 2;
        if (x > 9) x -= 9;
      }
      sum += x;
    }
    if (sum % 10 === 0) return imei;
  }
  throw new Error('unreachable');
}

/** Gera CPF válido aleatório. */
export function randomCpf(): string {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (len: number) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += n[i] * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  n.push(dv(9));
  n.push(dv(10));
  return n.join('');
}

export interface TestCtx {
  app: INestApplication;
  http: () => ReturnType<typeof request>;
  prisma: PrismaService;
  clock: ClockService;
  billing: BillingService;
  mail: MailService;
  mock: MockPaymentGateway;
}

export async function createTestApp(): Promise<TestCtx> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register({ scheduler: false })],
  }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  setupApp(app);
  await app.init();
  return {
    app,
    http: () => request(app.getHttpServer()),
    prisma: app.get(PrismaService),
    clock: app.get(ClockService),
    billing: app.get(BillingService),
    mail: app.get(MailService),
    mock: app.get(MockPaymentGateway),
  };
}

export async function registerUser(
  ctx: TestCtx,
  overrides: Record<string, unknown> = {},
) {
  const email = `cliente.${Date.now()}.${Math.floor(Math.random() * 1e6)}@teste.com`;
  const body = {
    name: 'Cliente de Teste',
    email,
    cpf: randomCpf(),
    phone: '11987654321',
    password: 'senhaSegura1',
    acceptTerms: true,
    ...overrides,
  };
  const res = await ctx
    .http()
    .post('/api/auth/register')
    .send(body)
    .expect(201);
  return {
    token: res.body.accessToken as string,
    user: res.body.user,
    body,
    cookies: res.headers['set-cookie'],
  };
}

export async function loginAdmin(ctx: TestCtx) {
  const res = await ctx
    .http()
    .post('/api/auth/login')
    .send({ email: 'admin@seguradora.local', password: 'Admin@12345' })
    .expect(200);
  return res.body.accessToken as string;
}

/** Envia ao webhook um evento assinado, exatamente como o gateway mock faria. */
export function sendWebhook(
  ctx: TestCtx,
  paymentId: string,
  status: 'APROVADO' | 'RECUSADO',
) {
  const { body, signature } = ctx.mock.buildWebhook(paymentId, status);
  return ctx
    .http()
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('x-mock-signature', signature)
    .send(body);
}

/** Cotação + compra + pagamento aprovado. Retorna a apólice ativa. */
export async function buyActivePolicy(
  ctx: TestCtx,
  token: string,
  opts: { imei?: string; plan?: string; method?: 'PIX' | 'CARTAO' } = {},
) {
  const quote = await ctx
    .http()
    .post('/api/quotes')
    .send({ imei: opts.imei ?? uniqueImei() })
    .expect(201);
  const purchase = await ctx
    .http()
    .post('/api/policies')
    .set('Authorization', `Bearer ${token}`)
    .send({
      quoteId: quote.body.id,
      planId: opts.plan ?? 'PREMIUM',
      method: opts.method ?? 'CARTAO',
    })
    .expect(201);
  await sendWebhook(ctx, purchase.body.payment.id, 'APROVADO').expect(200);
  const policy = await ctx
    .http()
    .get(`/api/policies/${purchase.body.policyId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return policy.body;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
