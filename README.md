# 📱 Insurtech – Seguradora de Celular (SaaS)

Plataforma de seguro de celular: o visitante **cota pelo IMEI**, cria a conta, **contrata com Pix ou cartão** (gateway em modo de testes), a assinatura **renova sozinha** todo mês e o cliente **aciona o seguro** pelo site, acompanhando a análise até o pagamento da franquia.

| Camada | Tecnologias |
| --- | --- |
| Backend | NestJS 10, Prisma 5, MySQL 8, JWT + refresh token em cookie httpOnly, Swagger, `@nestjs/schedule`, `@nestjs/throttler`, helmet |
| Frontend | React 18, Vite, TypeScript, MUI, React Router, TanStack Query, React Hook Form + Zod |
| Integrações | Consulta de IMEI (`ImeiProvider`: mock ou HTTP) · Pagamentos (`PaymentGateway`: mock ou Mercado Pago sandbox) · E-mail (SMTP/Mailpit) |
| Qualidade | Jest + Supertest (integração com MySQL real), Vitest + Testing Library, Playwright, ESLint, Prettier, Husky + lint-staged + commitlint, GitHub Actions |

## Estrutura

```
backend/          API NestJS (src/, prisma/ com schema, migrations e seeds, test/ com testes de integração)
frontend/         SPA React (src/, e2e/ com o teste Playwright)
docs/             Escopo, regras de negócio, user stories, DER, arquitetura e documento do projeto
docker-compose.yml  MySQL + Adminer + Mailpit
```

## Como rodar

Pré-requisitos: **Node 20+** e, de preferência, **Docker**.

### 1. Instalar dependências

```bash
npm run install:all
```

### 2. Subir o banco

**Com Docker (recomendado):**

```bash
docker compose up -d          # MySQL :3306 · Adminer http://localhost:8080 · Mailpit http://localhost:8025
cp backend/.env.example backend/.env
```

**Sem Docker:** o projeto sobe um MySQL temporário com o pacote `mysql-memory-server` (baixa o MySQL na 1ª vez):

```bash
npm run db:local              # deixe este terminal aberto (MySQL na porta 3307)
cp backend/.env.example backend/.env
# no backend/.env troque DATABASE_URL para: mysql://root@127.0.0.1:3307/seguradora
# e apague SMTP_HOST (os e-mails aparecem em Admin › Ferramentas de teste)
```

### 3. Criar as tabelas e os dados

```bash
cd backend
npx prisma migrate deploy     # aplica as migrations
npm run db:seed               # planos, coberturas, modelos de aparelho, FAQ e admin
npm run db:seed:demo          # (opcional) clientes de demonstração com apólices, sinistros e chamados
```

### 4. Iniciar API e frontend (dois terminais)

```bash
npm run dev:api               # http://localhost:3000/api · Swagger em http://localhost:3000/api/docs
npm run dev:web               # http://localhost:5173
```

O rodapé do site mostra **“Sistema online · banco ok”** quando front, API e banco estão conectados (`GET /api/health`).

## Acessos de teste

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Atendente (admin) | `admin@seguradora.local` | `Admin@12345` |
| Cliente em dia, sinistro em análise | `ana@demo.local` | `Cliente@123` |
| Cliente inadimplente, franquia a pagar | `bruno@demo.local` | `Cliente@123` |
| Cliente com cobertura suspensa | `carla@demo.local` | `Cliente@123` |

(Os clientes só existem depois de `npm run db:seed:demo`.)

### IMEIs de teste (provedor mock)

| IMEI | Resultado |
| --- | --- |
| `350000011234560` | Apple iPhone 16 – elegível |
| `350000041234564` | Samsung Galaxy S25 – elegível |
| `350000061234569` | Motorola Moto G85 – elegível |
| `359999991234568` | Bloqueado (roubo/perda) |
| `350000081234565` | Galaxy S9 – modelo com mais de 3 anos |
| `350000091234563` | Moto E14 – abaixo de R$ 800 |
| `350000101234561` | Galaxy Z Fold7 – acima de R$ 15.000 |
| `350000201234560` | Modelo fora da tabela |
| `350000001234562` | Simula a API de IMEI fora do ar |

Qualquer outro IMEI válido (Luhn) recebe um modelo elegível. Lista completa: `npx ts-node backend/scripts/test-imeis.ts`.

### Pagamentos em modo de testes

Com `PAYMENT_GATEWAY=mock` (padrão), o Pix mostra um QR Code fictício e o cartão abre uma página de **gateway simulado** com os botões “Aprovar” e “Recusar”. A confirmação chega pelo mesmo webhook assinado (HMAC) que um gateway real usaria.

Para usar o **Mercado Pago sandbox**, defina `PAYMENT_GATEWAY=mercadopago`, `MERCADOPAGO_ACCESS_TOKEN=TEST-...` e `PAYMENT_WEBHOOK_SECRET` com a chave de assinatura do painel. Para o webhook alcançar sua máquina, exponha a API com um túnel (ex.: `ngrok http 3000`) e ajuste `API_URL`.

### Demonstrar renovação e inadimplência

Entre como admin e use **Atendimento › Ferramentas de teste**. Ali você avança o relógio do sistema N dias (a rotina diária de cobrança roda para cada dia), escolhe se as renovações no cartão serão aprovadas ou recusadas e vê os e-mails enviados. As mesmas ações existem em `/api/dev/*`, que só ficam ativas com `ENABLE_DEV_TOOLS=true` fora de produção.

## Testes

```bash
cd backend
npm test                # unitários: IMEI (Luhn), CPF, preço, franquia, elegibilidade, transições de status
npm run test:e2e        # integração (Jest + Supertest + MySQL real): cotação, auth, compra, webhook, renovação, sinistro, suporte

cd ../frontend
npm test                # componentes (Vitest + Testing Library): cotação e cadastro
npm run test:e2e        # Playwright: cotar → cadastrar → comprar → acionar → admin aprova → franquia → concluído (desktop e celular)
```

`npm run test:e2e` do backend sobe sozinho um MySQL temporário. Para usar outro banco, defina `E2E_DATABASE_URL` (**ele é apagado e recriado**). O Playwright precisa da API e do frontend rodando, ou sobe os dois sozinho.

## Variáveis de ambiente

Todas estão documentadas em [`backend/.env.example`](backend/.env.example). Principais:

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | Conexão MySQL |
| `JWT_ACCESS_SECRET` | Assinatura do token de acesso (mín. 16 caracteres) |
| `IMEI_PROVIDER` | `mock` ou `http` (+ `IMEI_API_URL`, `IMEI_API_KEY`) |
| `PAYMENT_GATEWAY` | `mock` ou `mercadopago` (+ `MERCADOPAGO_ACCESS_TOKEN`) |
| `PAYMENT_WEBHOOK_SECRET` | Validação da assinatura dos webhooks |
| `SMTP_HOST`/`SMTP_PORT` | E-mails (Mailpit no docker compose); vazio = só loga |
| `ENABLE_DEV_TOOLS` | Habilita `/api/dev/*` (nunca em produção) |

## Fluxo de trabalho

- `main` protegida; branches `feature/...` ou `fix/...`; Pull Request com pelo menos uma aprovação.
- Commits convencionais (`feat:`, `fix:`, `docs:` …): o hook `commit-msg` valida com o commitlint.
- O hook `pre-commit` roda Prettier e ESLint nos arquivos alterados (lint-staged).
- A CI (`.github/workflows/ci.yml`) roda lint, build, testes unitários, de integração, de componentes e o Playwright a cada PR.

## Documentação

- [Escopo do MVP](docs/escopo-mvp.md) · [Regras de negócio](docs/regras-de-negocio.md) · [User stories](docs/user-stories.md)
- [DER](docs/der.md) · [Arquitetura e fluxos](docs/arquitetura.md) · [Documento do projeto](docs/documento-do-projeto.md)
- Contrato da API: Swagger em `http://localhost:3000/api/docs`

## Responsáveis

- André Bastos dos Santos
- André Filipi da Silveira de Sousa
- Larissa da Silva Maschio
- Pedro Henrique Gomes dos Santos
