import {
  auth,
  buyActivePolicy,
  createTestApp,
  loginAdmin,
  registerUser,
  sendWebhook,
  TestCtx,
  uniqueImei,
} from './helpers';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);
const PDF = Buffer.from('%PDF-1.4\n%fake\n');
const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe('Fases 6 a 8 – compra, renovação, sinistro e suporte (integração)', () => {
  let ctx: TestCtx;
  let adminToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    adminToken = await loginAdmin(ctx);
  });
  afterAll(async () => {
    ctx.clock.reset();
    await ctx.app.close();
  });
  beforeEach(() => {
    ctx.mock.renewalOutcome = 'approve';
  });

  describe('Fase 6 – compra e pagamento', () => {
    beforeAll(() => ctx.clock.set(day('2026-01-10')));

    it('Pix: compra fica aguardando, webhook assinado ativa e reenvio não duplica', async () => {
      const { token } = await registerUser(ctx);
      const imei = uniqueImei();
      const quote = await ctx
        .http()
        .post('/api/quotes')
        .send({ imei })
        .expect(201);
      const purchase = await ctx
        .http()
        .post('/api/policies')
        .set(auth(token))
        .send({
          quoteId: quote.body.id,
          planId: 'INTERMEDIARIO',
          method: 'PIX',
        })
        .expect(201);
      expect(purchase.body.payment).toMatchObject({
        status: 'PENDENTE',
        method: 'PIX',
        cycle: 1,
      });
      expect(purchase.body.payment.pixQrCode).toEqual(expect.any(String));

      let policy = await ctx
        .http()
        .get(`/api/policies/${purchase.body.policyId}`)
        .set(auth(token))
        .expect(200);
      expect(policy.body.status).toBe('AGUARDANDO_PAGAMENTO');

      // Assinatura inválida é rejeitada
      await ctx
        .http()
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-mock-signature', 'assinatura-falsa')
        .send({
          id: 'evt_x',
          paymentId: purchase.body.payment.id,
          status: 'APROVADO',
        })
        .expect(401);

      const { body, signature } = ctx.mock.buildWebhook(
        purchase.body.payment.id,
        'APROVADO',
      );
      const send = () =>
        ctx
          .http()
          .post('/api/payments/webhook')
          .set('Content-Type', 'application/json')
          .set('x-mock-signature', signature)
          .send(body);
      expect((await send().expect(200)).body).toMatchObject({
        processed: true,
        status: 'APROVADO',
      });
      expect((await send().expect(200)).body).toMatchObject({
        processed: false,
        reason: 'duplicado',
      });
      // Um evento novo para o mesmo pagamento também não reaplica o efeito.
      expect(
        (
          await sendWebhook(ctx, purchase.body.payment.id, 'APROVADO').expect(
            200,
          )
        ).body.processed,
      ).toBe(false);

      policy = await ctx
        .http()
        .get(`/api/policies/${purchase.body.policyId}`)
        .set(auth(token))
        .expect(200);
      expect(policy.body).toMatchObject({
        status: 'ATIVA',
        subscription: { status: 'ATIVA', cycle: 1 },
      });
      expect(new Date(policy.body.startsAt).toISOString()).toBe(
        '2026-01-10T12:00:00.000Z',
      );
      expect(new Date(policy.body.endsAt).toISOString()).toBe(
        '2026-02-10T12:00:00.000Z',
      );
      expect(
        policy.body.subscription.payments.filter(
          (p: any) => p.status === 'APROVADO',
        ),
      ).toHaveLength(1);
      expect(
        ctx.mail.outbox.some((m) =>
          m.subject.startsWith(`Seguro ativo – apólice ${policy.body.number}`),
        ),
      ).toBe(true);

      // Mesmo IMEI não pode ter duas apólices ativas
      const again = await ctx
        .http()
        .post('/api/quotes')
        .send({ imei })
        .expect(422);
      expect(again.body.code).toBe('APOLICE_EXISTENTE');
      const other = await registerUser(ctx);
      const dup = await ctx
        .http()
        .post('/api/policies')
        .set(auth(other.token))
        .send({ quoteId: quote.body.id, planId: 'BASICO', method: 'PIX' })
        .expect(409);
      expect(dup.body.code).toBe('APOLICE_EXISTENTE');
    });

    it('cartão recusado não ativa nada; nova tentativa aprovada ativa', async () => {
      const { token } = await registerUser(ctx);
      const quote = await ctx
        .http()
        .post('/api/quotes')
        .send({ imei: uniqueImei() })
        .expect(201);
      const purchase = await ctx
        .http()
        .post('/api/policies')
        .set(auth(token))
        .send({ quoteId: quote.body.id, planId: 'PREMIUM', method: 'CARTAO' })
        .expect(201);
      expect(purchase.body.payment.checkoutUrl).toContain('/checkout-simulado');
      await sendWebhook(ctx, purchase.body.payment.id, 'RECUSADO').expect(200);

      let policy = await ctx
        .http()
        .get(`/api/policies/${purchase.body.policyId}`)
        .set(auth(token))
        .expect(200);
      expect(policy.body.status).toBe('AGUARDANDO_PAGAMENTO');
      expect(policy.body.subscription.payments[0].status).toBe('RECUSADO');

      const retry = await ctx
        .http()
        .post('/api/payments')
        .set(auth(token))
        .send({ policyId: purchase.body.policyId, method: 'CARTAO' })
        .expect(201);
      expect(retry.body.attempt).toBe(2);
      await sendWebhook(ctx, retry.body.id, 'APROVADO').expect(200);
      policy = await ctx
        .http()
        .get(`/api/policies/${purchase.body.policyId}`)
        .set(auth(token))
        .expect(200);
      expect(policy.body.status).toBe('ATIVA');
    });

    it('cotação expirada não pode ser contratada', async () => {
      const { token } = await registerUser(ctx);
      const quote = await ctx
        .http()
        .post('/api/quotes')
        .send({ imei: uniqueImei() })
        .expect(201);
      ctx.clock.set(day('2026-01-18'));
      const res = await ctx
        .http()
        .post('/api/policies')
        .set(auth(token))
        .send({ quoteId: quote.body.id, planId: 'PREMIUM', method: 'PIX' })
        .expect(422);
      expect(res.body.code).toBe('COTACAO_EXPIRADA');
      ctx.clock.set(day('2026-01-10'));
    });

    it('cliente não acessa apólice nem pagamento de outro cliente', async () => {
      const a = await registerUser(ctx);
      const b = await registerUser(ctx);
      const policy = await buyActivePolicy(ctx, a.token);
      await ctx
        .http()
        .get(`/api/policies/${policy.id}`)
        .set(auth(b.token))
        .expect(403);
      await ctx
        .http()
        .get(`/api/payments/${policy.subscription.payments[0].id}`)
        .set(auth(b.token))
        .expect(403);
      await ctx
        .http()
        .get(`/api/subscriptions/${policy.subscription.id}`)
        .set(auth(b.token))
        .expect(403);
    });
  });

  describe('Fase 7 – renovação, inadimplência e cancelamento', () => {
    it('renova com pagamento aprovado, fica inadimplente, é suspensa, reativa e depois é cancelada', async () => {
      ctx.clock.set(day('2026-01-10'));
      const { token, body: user } = await registerUser(ctx);
      const policy = await buyActivePolicy(ctx, token, { method: 'CARTAO' });
      const get = () =>
        ctx
          .http()
          .get(`/api/policies/${policy.id}`)
          .set(auth(token))
          .expect(200)
          .then((r) => r.body);

      // Aviso 5 dias antes
      ctx.clock.set(day('2026-02-05'));
      expect((await ctx.billing.runDaily()).reminders).toBeGreaterThanOrEqual(
        1,
      );
      expect(
        ctx.mail.outbox.some(
          (m) => m.to === user.email && m.subject.includes('vence em breve'),
        ),
      ).toBe(true);

      // Cobrança 3 dias antes, débito automático aprovado → ciclo 2
      ctx.clock.set(day('2026-02-07'));
      await ctx.billing.runDaily();
      let p = await get();
      expect(p.subscription.cycle).toBe(2);
      expect(new Date(p.endsAt).toISOString()).toBe('2026-03-10T12:00:00.000Z');

      // Rodar de novo no mesmo dia não cobra duas vezes o mesmo ciclo
      await ctx.billing.runDaily();
      await ctx.billing.runDaily();
      p = await get();
      expect(
        p.subscription.payments.filter((x: any) => x.cycle === 2),
      ).toHaveLength(1);
      expect(
        p.subscription.payments.filter((x: any) => x.cycle === 3),
      ).toHaveLength(0);

      // Próximo ciclo recusado
      ctx.mock.renewalOutcome = 'decline';
      ctx.clock.set(day('2026-03-07'));
      await ctx.billing.runDaily();
      p = await get();
      expect(p.subscription.status).toBe('ATIVA');
      expect(
        p.subscription.payments.find((x: any) => x.cycle === 3).status,
      ).toBe('RECUSADO');

      ctx.clock.set(day('2026-03-10'));
      await ctx.billing.runDaily();
      p = await get();
      expect(p.subscription.status).toBe('INADIMPLENTE');
      expect(p.status).toBe('ATIVA'); // tolerância até o dia 10

      ctx.clock.set(day('2026-03-13'));
      await ctx.billing.runDaily();
      ctx.clock.set(day('2026-03-17'));
      await ctx.billing.runDaily();
      await ctx.billing.runDaily();
      p = await get();
      expect(
        p.subscription.payments
          .filter((x: any) => x.cycle === 3)
          .map((x: any) => x.attempt)
          .sort(),
      ).toEqual([1, 2, 3]);

      ctx.clock.set(day('2026-03-20'));
      await ctx.billing.runDaily();
      p = await get();
      expect(p).toMatchObject({
        status: 'SUSPENSA',
        subscription: { status: 'SUSPENSA' },
      });

      // Suspensa: não pode acionar o seguro
      const blocked = await ctx
        .http()
        .post('/api/claims')
        .set(auth(token))
        .send({
          policyId: policy.id,
          type: 'ROUBO',
          occurredAt: day('2026-03-19'),
          location: 'São Paulo',
          description: 'Fui abordado na rua e levaram o aparelho.',
        })
        .expect(422);
      expect(blocked.body.code).toBe('APOLICE_INATIVA');

      // Cliente paga a mensalidade em atraso por Pix → volta a ativa, sem buraco na vigência
      const pay = await ctx
        .http()
        .post('/api/payments')
        .set(auth(token))
        .send({ policyId: policy.id, method: 'PIX' })
        .expect(201);
      expect(pay.body.attempt).toBe(4);
      await sendWebhook(ctx, pay.body.id, 'APROVADO').expect(200);
      p = await get();
      expect(p).toMatchObject({
        status: 'ATIVA',
        subscription: { status: 'ATIVA', cycle: 3, delinquentSince: null },
      });
      expect(new Date(p.endsAt).toISOString()).toBe('2026-04-10T12:00:00.000Z');

      // Sem pagamento por 30 dias → cancelada (Pix fica pendente e não é pago)
      ctx.clock.set(day('2026-04-07'));
      await ctx.billing.runDaily();
      ctx.clock.set(day('2026-04-10'));
      await ctx.billing.runDaily();
      ctx.clock.set(day('2026-05-10'));
      await ctx.billing.runDaily();
      p = await get();
      expect(p).toMatchObject({
        status: 'CANCELADA',
        subscription: { status: 'CANCELADA' },
      });
      expect(
        p.subscription.payments.some((x: any) => x.status === 'PENDENTE'),
      ).toBe(false);
    });

    it('cancelamento pelo cliente mantém a cobertura até o fim do ciclo e não gera nova cobrança', async () => {
      ctx.clock.set(day('2026-01-10'));
      const { token } = await registerUser(ctx);
      const policy = await buyActivePolicy(ctx, token);
      const res = await ctx
        .http()
        .post(`/api/subscriptions/${policy.subscription.id}/cancel`)
        .set(auth(token))
        .expect(201);
      expect(res.body).toMatchObject({
        status: 'ATIVA',
        cancelAtPeriodEnd: true,
        nextBillingAt: null,
      });
      await ctx
        .http()
        .post(`/api/subscriptions/${policy.subscription.id}/cancel`)
        .set(auth(token))
        .expect(409);

      ctx.clock.set(day('2026-02-08'));
      await ctx.billing.runDaily();
      let p = (
        await ctx.http().get(`/api/policies/${policy.id}`).set(auth(token))
      ).body;
      expect(p.status).toBe('ATIVA');
      expect(p.subscription.payments).toHaveLength(1);

      ctx.clock.set(day('2026-02-10'));
      await ctx.billing.runDaily();
      p = (await ctx.http().get(`/api/policies/${policy.id}`).set(auth(token)))
        .body;
      expect(p).toMatchObject({
        status: 'CANCELADA',
        subscription: { status: 'CANCELADA' },
      });
    });

    it('troca de plano vale a partir do próximo ciclo', async () => {
      ctx.clock.set(day('2026-01-10'));
      const { token } = await registerUser(ctx);
      const policy = await buyActivePolicy(ctx, token, { plan: 'BASICO' });
      const res = await ctx
        .http()
        .post(`/api/subscriptions/${policy.subscription.id}/change-plan`)
        .set(auth(token))
        .send({ planId: 'PREMIUM' })
        .expect(201);
      expect(res.body.pendingPlan.name).toBe('Premium');

      ctx.clock.set(day('2026-02-07'));
      await ctx.billing.runDaily();
      const p = (
        await ctx.http().get(`/api/policies/${policy.id}`).set(auth(token))
      ).body;
      expect(p.plan.code).toBe('PREMIUM');
      expect(p.monthlyPriceCents).toBe(9_899); // 5.499,00 × 1,8%
      expect(p.subscription.pendingPlan).toBeNull();
    });
  });

  describe('Fase 8 – sinistro', () => {
    it('carência, cobertura não contratada e prazo são barrados com mensagem clara', async () => {
      ctx.clock.set(day('2026-01-10'));
      const { token } = await registerUser(ctx);
      const basic = await buyActivePolicy(ctx, token, { plan: 'BASICO' });
      const premium = await buyActivePolicy(ctx, token, { plan: 'PREMIUM' });
      const claim = (policyId: string, type: string, occurredAt: Date) =>
        ctx.http().post('/api/claims').set(auth(token)).send({
          policyId,
          type,
          occurredAt,
          location: 'Rua das Flores, 100 – Curitiba/PR',
          description: 'O aparelho caiu no chão e a tela trincou inteira.',
        });

      ctx.clock.set(day('2026-01-15'));
      let res = await claim(premium.id, 'ROUBO', day('2026-01-14')).expect(422);
      expect(res.body.code).toBe('EM_CARENCIA');

      ctx.clock.set(day('2026-02-01'));
      res = await claim(
        premium.id,
        'QUEBRA_ACIDENTAL',
        day('2026-01-31'),
      ).expect(422);
      expect(res.body.code).toBe('EM_CARENCIA'); // 30 dias para quebra
      res = await claim(basic.id, 'QUEBRA_ACIDENTAL', day('2026-01-31')).expect(
        422,
      );
      expect(res.body.code).toBe('COBERTURA_NAO_CONTRATADA');
      res = await claim(premium.id, 'ROUBO', day('2026-02-02')).expect(400);
      expect(res.body.code).toBe('DATA_INVALIDA');
    });

    it('fluxo completo: abrir, enviar documentos, analisar, aprovar, pagar franquia e concluir', async () => {
      ctx.clock.set(day('2026-01-10'));
      const owner = await registerUser(ctx);
      const stranger = await registerUser(ctx);
      const policy = await buyActivePolicy(ctx, owner.token, {
        plan: 'PREMIUM',
      });

      ctx.clock.set(day('2026-02-12'));
      const created = await ctx
        .http()
        .post('/api/claims')
        .set(auth(owner.token))
        .send({
          policyId: policy.id,
          type: 'QUEBRA_ACIDENTAL',
          occurredAt: day('2026-02-11'),
          location: 'Casa',
          description: 'Derrubei o celular da mesa e a tela quebrou.',
        })
        .expect(201);
      const id = created.body.id;
      expect(created.body).toMatchObject({
        status: 'ABERTO',
        deductibleCents: 82_485,
      }); // 15% de 5.499,00
      expect(created.body.events).toHaveLength(1);

      // Upload: aceita PNG/PDF, recusa outro conteúdo
      const up = await ctx
        .http()
        .post(`/api/claims/${id}/documents`)
        .set(auth(owner.token))
        .attach('files', PNG, 'foto1.png')
        .attach('files', PDF, 'laudo.pdf')
        .expect(201);
      expect(up.body.documents).toHaveLength(2);
      const bad = await ctx
        .http()
        .post(`/api/claims/${id}/documents`)
        .set(auth(owner.token))
        .attach('files', Buffer.from('não sou imagem'), 'foto.png')
        .expect(400);
      expect(bad.body.code).toBe('TIPO_DE_ARQUIVO_INVALIDO');

      // Arquivo só para o dono ou admin
      const docId = up.body.documents[0].id;
      await ctx
        .http()
        .get(`/api/claims/${id}`)
        .set(auth(stranger.token))
        .expect(403);
      await ctx
        .http()
        .get(`/api/claims/${id}/documents/${docId}`)
        .set(auth(stranger.token))
        .expect(403);
      const file = await ctx
        .http()
        .get(`/api/claims/${id}/documents/${docId}`)
        .set(auth(owner.token))
        .expect(200);
      expect(file.headers['content-type']).toBe('image/png');
      await ctx
        .http()
        .get(`/api/claims/${id}/documents/${docId}`)
        .set(auth(adminToken))
        .expect(200);

      // Somente admin decide; transições fora de ordem são recusadas
      await ctx
        .http()
        .post(`/api/admin/claims/${id}/start-analysis`)
        .set(auth(owner.token))
        .expect(403);
      const early = await ctx
        .http()
        .post(`/api/admin/claims/${id}/approve`)
        .set(auth(adminToken))
        .send({ reason: 'Documentos ok' })
        .expect(409);
      expect(early.body.code).toBe('TRANSICAO_INVALIDA');
      await ctx
        .http()
        .post(`/api/admin/claims/${id}/start-analysis`)
        .set(auth(adminToken))
        .expect(201);
      const approved = await ctx
        .http()
        .post(`/api/admin/claims/${id}/approve`)
        .set(auth(adminToken))
        .send({ reason: 'Fotos comprovam o dano.' })
        .expect(201);
      expect(approved.body.status).toBe('AGUARDANDO_FRANQUIA');

      const list = await ctx
        .http()
        .get('/api/admin/claims?status=AGUARDANDO_FRANQUIA')
        .set(auth(adminToken))
        .expect(200);
      expect(list.body.data.some((c: any) => c.id === id)).toBe(true);

      // Franquia paga via módulo de pagamentos → concluído
      const pay = await ctx
        .http()
        .post('/api/payments')
        .set(auth(owner.token))
        .send({ claimId: id, method: 'PIX' })
        .expect(201);
      expect(pay.body).toMatchObject({
        purpose: 'FRANQUIA',
        amountCents: 82_485,
      });
      await sendWebhook(ctx, pay.body.id, 'APROVADO').expect(200);
      const done = await ctx
        .http()
        .get(`/api/claims/${id}`)
        .set(auth(owner.token))
        .expect(200);
      expect(done.body.status).toBe('CONCLUIDO');
      expect(done.body.events.map((e: any) => e.toStatus)).toEqual([
        'ABERTO',
        'EM_ANALISE',
        'APROVADO',
        'AGUARDANDO_FRANQUIA',
        'CONCLUIDO',
      ]);
      // Quebra não encerra a apólice
      const p = (
        await ctx
          .http()
          .get(`/api/policies/${policy.id}`)
          .set(auth(owner.token))
      ).body;
      expect(p.status).toBe('ATIVA');
    });

    it('sinistro em andamento bloqueia outro; limite de 2 por 12 meses; negado não conta', async () => {
      ctx.clock.set(day('2026-01-10'));
      const { token } = await registerUser(ctx);
      const policy = await buyActivePolicy(ctx, token, { plan: 'PREMIUM' });
      ctx.clock.set(day('2026-02-12'));
      const open = (type = 'QUEBRA_ACIDENTAL') =>
        ctx
          .http()
          .post('/api/claims')
          .set(auth(token))
          .send({
            policyId: policy.id,
            type,
            occurredAt: day('2026-02-11'),
            location: 'Escritório',
            description: 'O aparelho caiu e parou de funcionar a tela.',
          });
      const decide = async (id: string, action: 'approve' | 'deny') => {
        await ctx
          .http()
          .post(`/api/admin/claims/${id}/start-analysis`)
          .set(auth(adminToken))
          .expect(201);
        await ctx
          .http()
          .post(`/api/admin/claims/${id}/${action}`)
          .set(auth(adminToken))
          .send({ reason: 'Decisão do teste' })
          .expect(201);
      };
      const finish = async (id: string) => {
        const pay = await ctx
          .http()
          .post('/api/payments')
          .set(auth(token))
          .send({ claimId: id, method: 'PIX' })
          .expect(201);
        await sendWebhook(ctx, pay.body.id, 'APROVADO').expect(200);
      };

      const c1 = (await open().expect(201)).body;
      expect((await open().expect(409)).body.code).toBe(
        'SINISTRO_EM_ANDAMENTO',
      );
      await decide(c1.id, 'deny');
      const denied = (
        await ctx.http().get(`/api/claims/${c1.id}`).set(auth(token))
      ).body;
      expect(denied).toMatchObject({
        status: 'NEGADO',
        decisionReason: 'Decisão do teste',
      });

      const c2 = (await open().expect(201)).body;
      await decide(c2.id, 'approve');
      await finish(c2.id);
      const c3 = (await open('DANO_LIQUIDO').expect(201)).body;
      await decide(c3.id, 'approve');
      await finish(c3.id);
      expect((await open().expect(422)).body.code).toBe('LIMITE_DE_SINISTROS');
    });

    it('roubo concluído encerra a apólice e cancela a assinatura', async () => {
      ctx.clock.set(day('2026-01-10'));
      const { token } = await registerUser(ctx);
      const policy = await buyActivePolicy(ctx, token, { plan: 'BASICO' });
      ctx.clock.set(day('2026-01-20'));
      const c = (
        await ctx
          .http()
          .post('/api/claims')
          .set(auth(token))
          .send({
            policyId: policy.id,
            type: 'ROUBO',
            occurredAt: day('2026-01-19'),
            location: 'Centro',
            description: 'Fui abordado por dois homens que levaram o celular.',
          })
          .expect(201)
      ).body;
      await ctx
        .http()
        .post(`/api/admin/claims/${c.id}/start-analysis`)
        .set(auth(adminToken))
        .expect(201);
      await ctx
        .http()
        .post(`/api/admin/claims/${c.id}/approve`)
        .set(auth(adminToken))
        .send({ reason: 'BO válido.' })
        .expect(201);
      const pay = await ctx
        .http()
        .post('/api/payments')
        .set(auth(token))
        .send({ claimId: c.id, method: 'PIX' })
        .expect(201);
      expect(pay.body.amountCents).toBe(137_475); // 25% de 5.499,00
      await sendWebhook(ctx, pay.body.id, 'APROVADO').expect(200);
      const p = (
        await ctx.http().get(`/api/policies/${policy.id}`).set(auth(token))
      ).body;
      expect(p).toMatchObject({
        status: 'ENCERRADA',
        subscription: { status: 'CANCELADA' },
      });
    });
  });

  describe('Fase 5 – suporte e feedback', () => {
    it('cliente abre chamado, admin responde (e-mail) e muda status; outro cliente não vê', async () => {
      const a = await registerUser(ctx);
      const b = await registerUser(ctx);
      const t = await ctx
        .http()
        .post('/api/tickets')
        .set(auth(a.token))
        .send({
          subject: 'Dúvida sobre franquia',
          category: 'APOLICE',
          message: 'Como é calculada a franquia?',
        })
        .expect(201);
      expect(t.body.status).toBe('ABERTO');
      await ctx
        .http()
        .get(`/api/tickets/${t.body.id}`)
        .set(auth(b.token))
        .expect(403);
      expect(
        (await ctx.http().get('/api/tickets').set(auth(b.token))).body.data,
      ).toHaveLength(0);

      const reply = await ctx
        .http()
        .post(`/api/tickets/${t.body.id}/messages`)
        .set(auth(adminToken))
        .send({
          body: 'É um percentual do valor do aparelho, conforme o plano.',
        })
        .expect(201);
      expect(reply.body.status).toBe('EM_ANDAMENTO');
      expect(reply.body.messages[1]).toMatchObject({
        author: 'Atendimento',
        fromStaff: true,
      });
      expect(
        ctx.mail.outbox.some(
          (m) => m.to === a.body.email && m.subject.includes('Nova resposta'),
        ),
      ).toBe(true);

      await ctx
        .http()
        .patch(`/api/admin/tickets/${t.body.id}/status`)
        .set(auth(a.token))
        .send({ status: 'RESOLVIDO' })
        .expect(403);
      const resolved = await ctx
        .http()
        .patch(`/api/admin/tickets/${t.body.id}/status`)
        .set(auth(adminToken))
        .send({ status: 'RESOLVIDO' })
        .expect(200);
      expect(resolved.body.status).toBe('RESOLVIDO');
      // Cliente responde → reabre
      const reopened = await ctx
        .http()
        .post(`/api/tickets/${t.body.id}/messages`)
        .set(auth(a.token))
        .send({ body: 'Obrigado!' })
        .expect(201);
      expect(reopened.body.status).toBe('ABERTO');

      const adminList = await ctx
        .http()
        .get('/api/tickets?status=ABERTO')
        .set(auth(adminToken))
        .expect(200);
      expect(adminList.body.data.some((x: any) => x.id === t.body.id)).toBe(
        true,
      );
    });

    it('feedback: só quem tem apólice envia, e só aparece após aprovação', async () => {
      ctx.clock.set(day('2026-01-10'));
      const noPolicy = await registerUser(ctx);
      const res = await ctx
        .http()
        .post('/api/feedbacks')
        .set(auth(noPolicy.token))
        .send({ rating: 5 })
        .expect(422);
      expect(res.body.code).toBe('SEM_APOLICE');

      const customer = await registerUser(ctx, {
        name: 'Joana Pereira da Silva',
      });
      await buyActivePolicy(ctx, customer.token);
      const fb = await ctx
        .http()
        .post('/api/feedbacks')
        .set(auth(customer.token))
        .send({ rating: 4, comment: 'Contratação rápida!' })
        .expect(201);
      let pub = await ctx.http().get('/api/feedbacks').expect(200);
      expect(pub.body.data.some((f: any) => f.id === fb.body.id)).toBe(false);

      await ctx
        .http()
        .patch(`/api/admin/feedbacks/${fb.body.id}`)
        .set(auth(adminToken))
        .send({ status: 'APROVADO' })
        .expect(200);
      pub = await ctx.http().get('/api/feedbacks').expect(200);
      const shown = pub.body.data.find((f: any) => f.id === fb.body.id);
      expect(shown).toMatchObject({ rating: 4, author: 'Joana S.' });
      expect(pub.body.averageRating).toEqual(expect.any(Number));
    });

    it('FAQ é pública', async () => {
      const res = await ctx.http().get('/api/faqs').expect(200);
      expect(res.body.length).toBeGreaterThan(5);
    });

    it('cliente comum não acessa rotas de admin', async () => {
      const { token } = await registerUser(ctx);
      await ctx.http().get('/api/admin/claims').set(auth(token)).expect(403);
      await ctx.http().get('/api/admin/feedbacks').set(auth(token)).expect(403);
      await ctx
        .http()
        .post('/api/dev/clock/advance')
        .set(auth(token))
        .send({ days: 1 })
        .expect(403);
    });
  });
});
