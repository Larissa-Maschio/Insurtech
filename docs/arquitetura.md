# Arquitetura e fluxos principais

## Visão geral

```mermaid
flowchart LR
    U[Navegador<br/>React SPA] -- "/api (JSON, Bearer JWT)<br/>cookie httpOnly de refresh" --> API
    subgraph API[API NestJS]
      direction TB
      AUTH[auth] --- QUOTES[quotes]
      QUOTES --- INS[insurance<br/>policies · subscriptions · billing]
      INS --- PAY[payments]
      CLAIMS[claims] --- PAY
      SUPPORT[support<br/>faqs · tickets · feedbacks]
      CLOCK[(ClockService)]
      CRON[[Rotina diária 03:00]]
    end
    API -- Prisma --> DB[(MySQL)]
    QUOTES -- ImeiProvider --> IMEI[API de IMEI<br/>ou mock]
    PAY -- PaymentGateway --> GW[Mercado Pago sandbox<br/>ou gateway mock]
    GW -- webhook assinado --> PAY
    API -- SMTP --> MAIL[Mailpit / SMTP]
    CLAIMS -- disco privado --> FS[(storage/)]
    CRON --> INS
```

**Decisões principais**

- **Integrações atrás de interfaces** (`ImeiProvider`, `PaymentGateway`): o sistema funciona e é testado com mocks, e a troca para o serviço real é só configuração (`IMEI_PROVIDER`, `PAYMENT_GATEWAY`).
- **Módulos sem dependência circular:** `payments` não conhece apólices nem sinistros. Os módulos `insurance` e `claims` registram *handlers* (`PaymentHandler`) que reagem quando uma mensalidade ou franquia é aprovada ou recusada.
- **Idempotência em três camadas:** (1) `webhook_events` guarda os ids dos eventos já processados; (2) o status do pagamento só muda se ainda estiver `PENDENTE` (update condicional); (3) a unicidade de `(assinatura, ciclo, tentativa)` impede que a rotina cobre duas vezes o mesmo ciclo.
- **Relógio injetável (`ClockService`):** toda regra de negócio usa `clock.now()`. Os testes fixam a data e a demonstração avança o tempo. Expiração de sessão e de links usa o tempo real.
- **Funções puras** para preço, franquia, elegibilidade e transições de status (`pricing.ts`, `transitions.ts`), todas cobertas por testes unitários.
- **Segurança:** argon2 nas senhas; JWT de 15 min; refresh token rotativo (hash SHA-256 no banco, cookie `httpOnly; SameSite=Lax`, path `/api/auth`); guards globais de autenticação e papel; checagem de dono em todo recurso; `helmet`; CORS restrito ao frontend; limites de requisição (login 5/min, cotação 10/min); upload validado pelo conteúdo do arquivo (*magic bytes*) e servido só ao dono ou admin; nenhum dado de cartão passa pela API.

## Sequência – compra e pagamento

```mermaid
sequenceDiagram
    autonumber
    actor C as Cliente
    participant F as Frontend
    participant A as API
    participant G as Gateway
    participant D as MySQL
    C->>F: Informa IMEI
    F->>A: POST /quotes
    A->>A: valida Luhn
    A->>G: (ImeiProvider) consulta IMEI (com cache)
    A->>D: cria cotação + preços por plano
    A-->>F: planos, preços, franquias
    C->>F: Contratar (login/cadastro se preciso)
    F->>A: POST /policies {quoteId, plano, método}
    A->>D: apólice AGUARDANDO_PAGAMENTO + assinatura PENDENTE + pagamento (ciclo 1)
    A->>G: cria cobrança (Pix ou checkout de cartão)
    A-->>F: QR Code Pix / link do checkout
    F->>F: consulta GET /payments/:id a cada 3 s
    C->>G: paga
    G->>A: POST /payments/webhook (assinado)
    A->>A: valida assinatura · idempotência
    A->>D: pagamento APROVADO · apólice ATIVA · vigência · próxima cobrança
    A-->>C: e-mail "Seguro ativo"
    F-->>C: "Pagamento aprovado!"
```

## Sequência – renovação automática

```mermaid
sequenceDiagram
    autonumber
    participant R as Rotina diária
    participant A as BillingService
    participant G as Gateway
    participant D as MySQL
    R->>A: runDaily(clock.now())
    A->>D: assinaturas ATIVA/INADIMPLENTE/SUSPENSA
    alt 5 dias antes do vencimento
      A-->>A: e-mail de aviso (uma vez por ciclo)
    end
    alt 3 dias antes e sem cobrança do próximo ciclo
      A->>D: pagamento (ciclo+1, tentativa 1) — único
      A->>G: cobrança (cartão: débito; Pix: novo QR por e-mail)
    end
    alt venceu sem pagamento
      A->>D: assinatura INADIMPLENTE (D0)
    end
    alt D3 / D7
      A->>G: nova tentativa (2 / 3)
    end
    alt D10
      A->>D: assinatura e apólice SUSPENSA
    end
    alt D30
      A->>D: CANCELADA · expira cobranças pendentes
    end
    G-->>A: pagamento aprovado (webhook)
    A->>D: ciclo+1 · vigência estendida · ATIVA
```

## Sequência – acionamento do seguro

```mermaid
sequenceDiagram
    autonumber
    actor C as Cliente
    actor S as Atendente
    participant A as API
    participant D as MySQL
    participant G as Gateway
    C->>A: POST /claims (apólice, tipo, data, local, descrição)
    A->>A: apólice ativa? cobertura no plano? fora da carência?<br/>até 30 dias? sem outro em andamento? limite 2/12 meses?
    A->>D: sinistro ABERTO + evento + franquia calculada
    C->>A: POST /claims/:id/documents (JPG/PNG/PDF ≤ 5 MB)
    S->>A: POST /admin/claims/:id/start-analysis
    A->>D: EM_ANALISE + evento
    S->>A: POST /admin/claims/:id/approve {motivo}
    A->>D: APROVADO → AGUARDANDO_FRANQUIA (+ eventos)
    A-->>C: e-mail "Sinistro aprovado"
    C->>A: POST /payments {claimId, método}
    A->>G: cobrança da franquia
    G->>A: webhook aprovado
    A->>D: CONCLUIDO + "reposição/reparo encaminhado"<br/>roubo/furto: apólice ENCERRADA
    A-->>C: e-mail "Sinistro concluído"
```
