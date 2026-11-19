# Documento do projeto – Seguradora de Celular (SaaS)

## 1. Visão do negócio

**Problema.** Perder ou quebrar o celular custa caro, e contratar seguro costuma ser burocrático, com vistoria, papelada e atendimento por telefone.

**Solução.** Um SaaS em que a pessoa cota pelo IMEI em segundos, contrata online uma assinatura mensal sem fidelidade e aciona o seguro pela mesma plataforma, acompanhando cada etapa.

**Público.** Pessoas físicas com smartphone de valor médio ou alto (R$ 800 a R$ 15.000, lançado há até 3 anos) que preferem resolver tudo online.

**Modelo de receita.** Mensalidade calculada como um percentual do valor do aparelho (0,9% a 1,8% por mês, conforme o plano), mais a franquia paga a cada sinistro aprovado.

Detalhes do escopo: [escopo-mvp.md](escopo-mvp.md) · regras: [regras-de-negocio.md](regras-de-negocio.md).

## 2. Requisitos funcionais

| Id | Requisito | User stories | Onde está |
| --- | --- | --- | --- |
| RF01 | Cotar pelo IMEI sem login: validar Luhn, consultar o aparelho, checar elegibilidade e mostrar os planos com preço, coberturas e franquias | US01, US02 | `quotes/`, `QuotePage`, `QuoteResultPage` |
| RF02 | Cadastro com CPF único e aceite LGPD; login; renovação de sessão; logout; recuperação de senha | US03–US05 | `auth/`, `AuthPages` |
| RF03 | Landing page com planos, FAQ e avaliações vindos da API | US06–US08 | `plans/`, `support/`, `LandingPage` |
| RF04 | Chamados de suporte com troca de mensagens; atendente responde e muda o status | US09, US10 | `support/`, `SupportPages` |
| RF05 | Compra: cotação → apólice → pagamento (Pix/cartão) → ativação por webhook | US11, US12 | `insurance/policies`, `payments/`, `CheckoutPage`, `PaymentPage` |
| RF06 | Renovação mensal automática, inadimplência (D0/D3/D7/D10/D30), cancelamento e troca de plano | US13–US15 | `insurance/billing`, `subscriptions`, `PolicyDetailPage` |
| RF07 | Sinistro: elegibilidade, documentos, linha do tempo, decisão do atendente e pagamento da franquia | US16–US18 | `claims/`, `ClaimsPages`, `AdminPages` |

## 3. Requisitos não funcionais

| Id | Requisito | Como foi atendido |
| --- | --- | --- |
| RNF01 | Segurança de credenciais | argon2; JWT de 15 min; refresh token rotativo em cookie httpOnly com hash no banco; mensagem genérica no login |
| RNF02 | Autorização | Guard global de autenticação e de papel; checagem de dono em apólice, pagamento, sinistro, documento e chamado (testes cobrem o acesso negado) |
| RNF03 | Proteção contra abuso | Limite de requisições (login 5/min, cotação 10/min, recuperação 3/min); validação de todos os DTOs com `whitelist` |
| RNF04 | Pagamentos | Nenhum dado de cartão na API (checkout hospedado/Pix); webhook com assinatura HMAC; processamento idempotente |
| RNF05 | LGPD | Coleta mínima; aceite registrado com data; nome abreviado nas avaliações públicas; logs sem senha nem token |
| RNF06 | Confiabilidade | Integrações atrás de interfaces com mock; falha da API de IMEI vira mensagem clara (503); e-mail que falha não derruba o fluxo |
| RNF07 | Testabilidade | Relógio injetável; funções puras; 24 testes unitários, 34 de integração com MySQL real, 9 de componentes e 1 E2E em dois dispositivos |
| RNF08 | Usabilidade e acessibilidade | Layout responsivo pensado para celular; foco de teclado visível; link "pular para o conteúdo"; títulos de página; textos alternativos; estados de carregamento, erro e lista vazia |
| RNF09 | Manutenibilidade | Monorepo; ESLint, Prettier, Husky, commitlint; CI em todo PR; contrato no Swagger |
| RNF10 | Portabilidade | `docker compose` para o banco e o e-mail; alternativa sem Docker (`npm run db:local`) |

## 4. Modelagem e arquitetura

- Modelo de dados, status e transições: [der.md](der.md)
- Arquitetura, decisões e diagramas de sequência (compra, renovação, acionamento): [arquitetura.md](arquitetura.md)
- Contrato da API: Swagger em `/api/docs`. Erros padronizados `{ statusCode, code, message, details?, path, timestamp }`; paginação `?page&pageSize` → `{ data, meta }`.

## 5. Decisões técnicas

| Decisão | Motivo |
| --- | --- |
| NestJS + Prisma + MySQL | Estrutura modular com injeção de dependência; Prisma gera tipos a partir do schema e versiona migrations |
| Valores em centavos e percentuais em basis points | Evita erros de arredondamento com ponto flutuante |
| Tabela de referência de modelos (`device_models`) | APIs de IMEI devolvem marca e modelo, mas não o preço; a tabela define valor e ano de lançamento |
| Gateway e IMEI com mock como padrão | O projeto roda e é avaliado sem chaves externas; a troca é só configuração |
| Mercado Pago (sandbox) como gateway real | Pix nativo e Checkout Pro, em que o cartão é digitado no site do gateway |
| Cartão renovado por débito no mock; Pix e Mercado Pago por nova cobrança enviada por e-mail | A recorrência real no Mercado Pago exige outro produto (assinaturas); a régua de inadimplência funciona igual nos dois casos |
| Rotas `/api/dev/*` e tela "Ferramentas de teste" | Permitem demonstrar ciclos de 30 dias em segundos; ficam desligadas em produção |

## 6. Limitações conhecidas

- Nenhuma API real de IMEI foi contratada. O `HttpImeiProvider` é genérico (URL e chave configuráveis) e pode precisar de ajuste em `mapResponse` para o fornecedor escolhido.
- A integração com o Mercado Pago foi escrita conforme a documentação pública, mas só os fluxos com o gateway mock foram testados automaticamente. Usá-la exige credenciais de teste e um túnel para o webhook.
- Estornos (ex.: pagamento aprovado para uma assinatura já cancelada) ficam registrados no log para tratamento manual.
- O relógio simulado é por processo: com várias instâncias da API, cada uma teria o seu. Isso é aceitável porque é uma ferramenta de demonstração.
- Os arquivos de sinistro ficam em disco local. Em produção, o ideal seria um armazenamento de objetos (S3 ou similar).
- Não há painel administrativo completo, apenas as telas de sinistros, chamados, avaliações e ferramentas de teste.

## 7. Trabalhos futuros

- Assinatura recorrente nativa do gateway (preapproval) e cartão salvo tokenizado.
- Vistoria do aparelho por foto na contratação e antifraude (consulta de bloqueio periódica).
- Painel administrativo com métricas (conversão de cotações, sinistralidade, inadimplência).
- Notificações por WhatsApp/push e aplicativo mobile.
- Seguro para outros dispositivos e várias apólices por assinatura.
- Deploy em nuvem com armazenamento de objetos e fila para os e-mails.
