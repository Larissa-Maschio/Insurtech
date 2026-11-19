# DER – Seguradora de Celular

Fonte da verdade: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma). Valores monetários em **centavos** (`INT`), percentuais em **basis points** (1% = 100), datas em UTC.

```mermaid
erDiagram
    users ||--o{ refresh_tokens : "sessões"
    users ||--o{ password_resets : "recuperação"
    users ||--o{ devices : "possui"
    users ||--o{ policies : "contrata"
    users ||--o{ claims : "aciona"
    users ||--o{ tickets : "abre"
    users ||--o{ ticket_messages : "escreve"
    users ||--o{ feedbacks : "avalia"
    users ||--o{ claim_events : "dispara"

    plans ||--o{ plan_coverages : "inclui"
    coverages ||--o{ plan_coverages : "faz parte"
    plans ||--o{ quote_items : "cotado em"
    quotes ||--o{ quote_items : "tem"
    quotes ||--o{ policies : "origina"
    plans ||--o{ policies : "define"
    devices ||--o{ policies : "segurado por"

    policies ||--|| subscriptions : "cobrada por"
    subscriptions ||--o{ payments : "mensalidades"
    policies ||--o{ claims : "sinistros"
    claims ||--o{ payments : "franquia"
    claims ||--o{ claim_documents : "documentos"
    claims ||--o{ claim_events : "histórico"
    policies ||--o{ tickets : "relacionada"
    tickets ||--o{ ticket_messages : "mensagens"

    users {
      uuid id PK
      varchar email UK
      char cpf UK
      varchar phone
      varchar password_hash "argon2"
      enum role "CUSTOMER | ADMIN"
      datetime terms_accepted_at "LGPD"
    }
    device_models {
      int id PK
      varchar brand
      varchar model
      int release_year
      int value_cents
    }
    devices {
      uuid id PK
      char imei
      varchar brand
      varchar model
      int value_cents
      uuid owner_id FK
    }
    plans {
      uuid id PK
      varchar code UK
      varchar name
      int monthly_rate_bps
    }
    coverages {
      uuid id PK
      enum code UK
      int grace_period_days "carência"
    }
    plan_coverages {
      uuid plan_id PK,FK
      uuid coverage_id PK,FK
      int deductible_bps "franquia"
    }
    quotes {
      uuid id PK
      char imei
      int device_value_cents
      datetime expires_at "7 dias"
    }
    quote_items {
      uuid quote_id PK,FK
      uuid plan_id PK,FK
      int monthly_price_cents
    }
    policies {
      uuid id PK
      varchar number UK
      enum status
      int monthly_price_cents
      datetime starts_at "base da carência"
      datetime ends_at "fim do ciclo pago"
    }
    subscriptions {
      uuid id PK
      uuid policy_id UK,FK
      enum status
      enum method "PIX | CARTAO"
      int cycle
      datetime current_period_end
      datetime next_billing_at
      bool cancel_at_period_end
      datetime delinquent_since
      uuid pending_plan_id FK
    }
    payments {
      uuid id PK
      enum purpose "MENSALIDADE | FRANQUIA"
      uuid subscription_id FK
      uuid claim_id FK
      int cycle "UK(subscription, cycle, attempt)"
      int attempt
      int amount_cents
      enum status
      varchar gateway_id UK
    }
    webhook_events {
      varchar id PK "idempotência"
    }
    imei_lookups {
      char imei PK "cache"
      bool blacklisted
      datetime fetched_at
    }
    claims {
      uuid id PK
      varchar number UK
      enum type "cobertura"
      enum status
      datetime occurred_at
      int deductible_cents
      varchar decision_reason
    }
    claim_documents {
      uuid id PK
      varchar mime_type
      varchar storage_path "fora da pasta pública"
    }
    claim_events {
      uuid id PK
      enum from_status
      enum to_status
      uuid actor_id FK
      varchar note
    }
    tickets {
      uuid id PK
      enum category
      enum status
    }
    ticket_messages {
      uuid id PK
      text body
    }
    faqs {
      uuid id PK
      varchar question
      text answer
    }
    feedbacks {
      uuid id PK
      int rating "1 a 5"
      enum status "moderação"
    }
```

## Status e transições permitidas

Implementadas em [`backend/src/domain/transitions.ts`](../backend/src/domain/transitions.ts) (com testes).

```mermaid
stateDiagram-v2
    direction LR
    state "Apólice" as P {
      [*] --> AGUARDANDO_PAGAMENTO
      AGUARDANDO_PAGAMENTO --> ATIVA: 1º pagamento aprovado
      AGUARDANDO_PAGAMENTO --> CANCELADA
      ATIVA --> SUSPENSA: 10 dias de atraso
      SUSPENSA --> ATIVA: pagamento em atraso
      ATIVA --> CANCELADA: cliente / 30 dias de atraso
      SUSPENSA --> CANCELADA
      ATIVA --> ENCERRADA: roubo/furto indenizado
    }
```

```mermaid
stateDiagram-v2
    direction LR
    [*] --> PENDENTE
    PENDENTE --> ATIVA: 1º pagamento
    ATIVA --> INADIMPLENTE: venceu sem pagar (D0)
    INADIMPLENTE --> ATIVA: pagou
    INADIMPLENTE --> SUSPENSA: D10
    SUSPENSA --> ATIVA: pagou
    SUSPENSA --> CANCELADA: D30
    ATIVA --> CANCELADA: fim do ciclo após cancelamento
    PENDENTE --> CANCELADA
```

```mermaid
stateDiagram-v2
    direction LR
    [*] --> ABERTO: cliente aciona
    ABERTO --> EM_ANALISE: atendente
    EM_ANALISE --> APROVADO: atendente (motivo)
    EM_ANALISE --> NEGADO: atendente (motivo)
    APROVADO --> AGUARDANDO_FRANQUIA: sistema gera a cobrança
    APROVADO --> CONCLUIDO: franquia zero
    AGUARDANDO_FRANQUIA --> CONCLUIDO: franquia paga (webhook)
```

## Índices relevantes

- `policies(user_id, status)`, `claims(user_id, status)`, `claims(status, created_at)`, `tickets(user_id, status)`, `tickets(status, updated_at)`, `subscriptions(status, next_billing_at)`, `devices(imei)`, `claim_events(claim_id, created_at)`, `feedbacks(status, created_at)`.
- Únicos que garantem regras: `users.email`, `users.cpf`, `payments(subscription_id, cycle, attempt)` (não cobra duas vezes o mesmo ciclo), `payments.gateway_id`, `webhook_events.id` (evento processado uma vez).
