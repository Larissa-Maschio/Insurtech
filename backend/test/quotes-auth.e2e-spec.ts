import {
  auth,
  createTestApp,
  IMEI,
  randomCpf,
  registerUser,
  TestCtx,
} from './helpers';

describe('Fases 1, 3 e 4 – health, cotação e autenticação (integração)', () => {
  let ctx: TestCtx;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api/health responde com API e banco ok', async () => {
    const res = await ctx.http().get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('GET /api/plans lista os 3 planos com coberturas vindas do banco', async () => {
    const res = await ctx.http().get('/api/plans').expect(200);
    expect(res.body.plans.map((p: any) => p.code)).toEqual([
      'BASICO',
      'INTERMEDIARIO',
      'PREMIUM',
    ]);
    expect(res.body.plans[0].coverages).toHaveLength(2);
    expect(res.body.plans[2].coverages).toHaveLength(5);
  });

  describe('POST /api/quotes', () => {
    it('cota um iPhone 16 com os preços e franquias corretos', async () => {
      const res = await ctx
        .http()
        .post('/api/quotes')
        .send({ imei: '35-000001-123456-0' })
        .expect(201);
      expect(res.body).toMatchObject({
        brand: 'Apple',
        model: 'iPhone 16',
        deviceValueCents: 649_900,
        expired: false,
      });
      const prices = Object.fromEntries(
        res.body.plans.map((p: any) => [p.code, p.monthlyPriceCents]),
      );
      // 6.499,00 × 0,9% = 58,491 → 58,50 ; × 1,3% = 84,487 → 84,49 ; × 1,8% = 116,982 → 116,99
      expect(prices).toEqual({
        BASICO: 5_850,
        INTERMEDIARIO: 8_449,
        PREMIUM: 11_699,
      });
      const premiumScreen = res.body.plans[2].coverages.find(
        (c: any) => c.code === 'QUEBRA_ACIDENTAL',
      );
      expect(premiumScreen.deductibleCents).toBe(97_485); // 15%

      const again = await ctx
        .http()
        .get(`/api/quotes/${res.body.id}`)
        .expect(200);
      expect(again.body.id).toBe(res.body.id);
    });

    it.each([
      [IMEI.iphone16.slice(0, 14) + '9', 400, 'IMEI_INVALIDO'],
      ['12345', 400, 'DADOS_INVALIDOS'],
      [IMEI.blocked, 422, 'APARELHO_BLOQUEADO'],
      [IMEI.galaxyS9_old, 422, 'APARELHO_ANTIGO'],
      [IMEI.motoE14_cheap, 422, 'VALOR_FORA_DA_FAIXA'],
      [IMEI.fold7_expensive, 422, 'VALOR_FORA_DA_FAIXA'],
      [IMEI.nokia_unknown, 422, 'MODELO_NAO_ENCONTRADO'],
      [IMEI.unavailable, 503, 'IMEI_SERVICO_INDISPONIVEL'],
    ])('IMEI %s → %d %s', async (imei, status, code) => {
      const res = await ctx
        .http()
        .post('/api/quotes')
        .send({ imei })
        .expect(status);
      expect(res.body.code).toBe(code);
      expect(res.body.message).toEqual(expect.any(String));
    });
  });

  describe('autenticação', () => {
    it('cadastra, devolve token e cookie httpOnly de refresh, e /me funciona', async () => {
      const { token, cookies, body } = await registerUser(ctx);
      expect(String(cookies)).toMatch(/refresh_token=.*HttpOnly/i);
      const me = await ctx.http().get('/api/me').set(auth(token)).expect(200);
      expect(me.body.email).toBe(body.email);
      expect(me.body).not.toHaveProperty('passwordHash');
    });

    it('recusa e-mail e CPF duplicados', async () => {
      const { body } = await registerUser(ctx);
      const dupEmail = await ctx
        .http()
        .post('/api/auth/register')
        .send({ ...body, cpf: randomCpf() })
        .expect(409);
      expect(dupEmail.body).toMatchObject({
        code: 'CADASTRO_DUPLICADO',
        details: { field: 'email' },
      });
      const dupCpf = await ctx
        .http()
        .post('/api/auth/register')
        .send({ ...body, email: `outro.${Date.now()}@teste.com` })
        .expect(409);
      expect(dupCpf.body.details.field).toBe('cpf');
    });

    it('valida CPF, senha fraca e aceite dos termos', async () => {
      const res = await ctx
        .http()
        .post('/api/auth/register')
        .send({
          name: 'X Y',
          email: 'a@b.com',
          cpf: '11111111111',
          phone: '11987654321',
          password: 'abc',
          acceptTerms: false,
        })
        .expect(400);
      expect(res.body.code).toBe('DADOS_INVALIDOS');
      expect(res.body.details.join(' ')).toMatch(/CPF inválido/);
      expect(res.body.details.join(' ')).toMatch(/senha/);
      expect(res.body.details.join(' ')).toMatch(/termos/);
    });

    it('senha errada e e-mail inexistente recebem a mesma mensagem genérica', async () => {
      const { body } = await registerUser(ctx);
      const wrong = await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: body.email, password: 'errada123' })
        .expect(401);
      const missing = await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: 'naoexiste@teste.com', password: 'errada123' })
        .expect(401);
      expect(wrong.body.message).toBe('E-mail ou senha incorretos.');
      expect(missing.body.message).toBe(wrong.body.message);
    });

    it('rotas protegidas recusam quem não está logado ou tem token inválido', async () => {
      await ctx.http().get('/api/me').expect(401);
      await ctx
        .http()
        .get('/api/policies')
        .set(auth('token-falso'))
        .expect(401);
    });

    it('refresh rotaciona o token e logout o revoga', async () => {
      const { cookies } = await registerUser(ctx);
      const refreshed = await ctx
        .http()
        .post('/api/auth/refresh')
        .set('Cookie', cookies)
        .expect(200);
      expect(refreshed.body.accessToken).toEqual(expect.any(String));
      // O token antigo foi rotacionado: reutilizá-lo falha.
      await ctx
        .http()
        .post('/api/auth/refresh')
        .set('Cookie', cookies)
        .expect(401);

      const newCookie = refreshed.headers['set-cookie'];
      await ctx
        .http()
        .post('/api/auth/logout')
        .set('Cookie', newCookie)
        .expect(204);
      await ctx
        .http()
        .post('/api/auth/refresh')
        .set('Cookie', newCookie)
        .expect(401);
    });

    it('recuperação de senha: e-mail com link, troca de senha e link de uso único', async () => {
      const { body } = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/auth/forgot-password')
        .send({ email: body.email })
        .expect(204);
      await ctx
        .http()
        .post('/api/auth/forgot-password')
        .send({ email: 'ninguem@teste.com' })
        .expect(204);
      const mail = ctx.mail.outbox
        .filter((m) => m.to === body.email && m.subject.includes('Redefinição'))
        .pop()!;
      const token = decodeURIComponent(/token=([^"&]+)/.exec(mail.html)![1]);

      await ctx
        .http()
        .post('/api/auth/reset-password')
        .send({ token, password: 'novaSenha99' })
        .expect(204);
      await ctx
        .http()
        .post('/api/auth/reset-password')
        .send({ token, password: 'outraSenha99' })
        .expect(422);
      await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: body.email, password: 'novaSenha99' })
        .expect(200);
    });

    it('limita tentativas de login (rate limit)', async () => {
      process.env.TEST_THROTTLE = 'true';
      try {
        const codes: number[] = [];
        for (let i = 0; i < 7; i++) {
          const r = await ctx
            .http()
            .post('/api/auth/login')
            .send({ email: 'brute@teste.com', password: 'x' });
          codes.push(r.status);
        }
        expect(codes).toContain(429);
      } finally {
        process.env.TEST_THROTTLE = 'false';
      }
    });
  });
});
