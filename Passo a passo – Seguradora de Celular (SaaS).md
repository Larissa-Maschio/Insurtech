# Passo a passo – Seguradora de Celular (SaaS)

Nov 18, 2026 · @Larissa

## Como usar este guia

O projeto vai do zero à apresentação final em 11 fases, cada uma com objetivo, passos e um critério de "pronto". Sigam a ordem: cada fase depende da anterior, salvo quando indicado. Não há datas por enquanto; o grupo define os prazos depois.

1. **Fase 0:** alinhamento do grupo e escopo
2. **Fase 1:** setup do projeto
3. **Fase 2:** banco de dados e contratos da API
4. **Fase 3:** cotação com consulta de IMEI
5. **Fase 4:** cadastro e login
6. **Fase 5:** landing page (planos, coberturas, FAQ, feedback, tickets)
7. **Fase 6:** compra e pagamento
8. **Fase 7:** renovação, assinatura e franquia
9. **Fase 8:** acionamento do seguro
10. **Fase 9:** testes, segurança e polimento
11. **Fase 10:** documentação, deploy e apresentação

Regras para o grupo seguir em todas as fases:

- Uma tarefa só está **pronta** quando funciona no ambiente local, tem ao menos um teste básico, foi revisada por outra pessoa e foi mesclada na `main`.
- Backend e frontend de uma mesma fase podem andar em paralelo, desde que o contrato da API (rotas e formato dos dados) seja combinado antes.
- Marquem os itens `- [ ]` deste documento conforme forem concluídos, para todos verem o progresso.

## Fase 0 – Alinhamento do grupo e escopo

**Objetivo:** todos entendem da mesma forma o que será entregue e quem faz o quê.

- [ ] Definir papéis principais (backend, frontend, banco e infraestrutura, documentação e testes). Todos podem mexer em tudo, mas cada área tem um responsável. *(não se aplica: desconsiderado a pedido)*
- [ ] Escolher a ferramenta de tarefas (GitHub Projects ou Trello) e o canal de comunicação do grupo. *(não se aplica: desconsiderado a pedido)*
- [ ] Confirmar com o professor o que a entrega exige: documentos, formato da apresentação, se o deploy é obrigatório e os critérios de avaliação. *(não se aplica: desconsiderado a pedido)*
- [x] Escrever o escopo do MVP em uma página, listando as 7 funcionalidades e o que fica de fora (por exemplo, aplicativo mobile e painel administrativo completo).
- [x] Definir as regras de negócio (ver tabela abaixo).
- [x] Escrever as user stories ("Como cliente, quero…") das 7 funcionalidades, cada uma com critérios de aceite.
- [x] Combinar a definição de "pronto" (a regra do início deste guia) e como serão as revisões de código.

Regras de negócio a decidir. Os valores são só exemplos de formato; o grupo escolhe os seus:

| Item | O que decidir | Exemplo de formato |
| --- | --- | --- |
| Planos | Quantos e com quais nomes | Básico, Intermediário, Premium |
| Coberturas | O que cada plano cobre | Roubo, furto, quebra de tela, dano por líquido |
| Preço mensal | Como calcular | Percentual do valor do aparelho, com fator por plano |
| Franquia | Quanto o cliente paga ao acionar | Percentual do valor do aparelho, por cobertura |
| Carência | Tempo entre a compra e o direito de acionar | Número de dias |
| Inadimplência | O que acontece com cobrança vencida | Dias de tolerância até cancelar |

**Pronto quando:** escopo, regras de negócio e backlog estão escritos e aprovados por todos os membros.

## Fase 1 – Setup do projeto

**Objetivo:** qualquer pessoa do grupo clona o repositório e roda tudo localmente em poucos minutos.

- [ ] Criar o repositório no GitHub (um monorepo com as pastas `backend/` e `frontend/` é o mais simples), com README, `.gitignore` e `.editorconfig`. *(parcial: repositório git local criado com README, .gitignore e .editorconfig; falta publicar no GitHub)*
- [ ] Definir o fluxo de branches: `main` protegida, branches `feature/nome-da-tarefa`, Pull Request com pelo menos uma aprovação, commits em formato convencional (`feat:`, `fix:`). *(parcial: commitlint e Husky configurados; a proteção da `main` é feita nas configurações do GitHub)*
- [x] Backend: criar o projeto com `nest new`; configurar variáveis de ambiente (`@nestjs/config`), `ValidationPipe` global com `class-validator`, prefixo `/api`, CORS e documentação Swagger (`@nestjs/swagger`).
- [x] Escolher **um** ORM e manter só ele: TypeORM ou Prisma. Configurar migrations desde o início, sem sincronização automática do schema.
- [x] Criar um `docker-compose.yml` com MySQL (e Adminer para visualizar o banco) e um `.env.example` com todas as variáveis.
- [x] Frontend: criar com Vite + React + TypeScript; adicionar React Router, um cliente HTTP (axios ou fetch com wrapper), TanStack Query, React Hook Form + Zod e uma biblioteca de componentes (MUI, shadcn/ui ou similar).
- [x] Configurar ESLint, Prettier e Husky com lint-staged para barrar commits fora do padrão.
- [x] Criar um workflow de CI no GitHub Actions que roda lint, build e testes a cada Pull Request.
- [x] Criar o endpoint `GET /api/health` e uma página inicial no frontend que o consulta, para provar que front, API e banco se comunicam.

**Pronto quando:** um membro novo clona o repositório, sobe o banco com `docker compose up`, inicia back e front e vê a página inicial mostrando a resposta do `/health`.

## Fase 2 – Banco de dados e contratos da API

**Objetivo:** modelar o banco inteiro e combinar as rotas da API antes de codar, para back e front trabalharem em paralelo sem retrabalho.

- [x] Desenhar o DER (dbdiagram.io ou draw.io) com as entidades da tabela abaixo e revisar em grupo.
- [x] Definir os status de cada fluxo (apólice, pagamento, assinatura, sinistro) como enums, desenhando as transições permitidas.
- [x] Criar as entidades e a primeira migration; subir o banco limpo a partir das migrations.
- [x] Criar os seeds: planos, coberturas, relação plano-cobertura, perguntas frequentes e um usuário administrador de teste.
- [x] Escrever o contrato das rotas no Swagger (nome, método, corpo e resposta) antes de implementar; o frontend usa isso como referência.
- [x] Padronizar: formato de erro (código, mensagem, detalhes), paginação, nomes de campos, datas em ISO 8601 e valores monetários em centavos (inteiros).

Entidades e campos principais:

| Entidade | Campos principais |
| --- | --- |
| `users` | nome, e-mail, CPF, telefone, senha (hash), papel, aceite dos termos |
| `devices` | IMEI, marca, modelo, valor estimado, dono |
| `plans` / `coverages` / `plan_coverages` | nome, descrição, percentuais de preço e franquia, cobertura incluída ou não |
| `quotes` | IMEI consultado, valor do aparelho, plano, preço, validade |
| `policies` | usuário, aparelho, plano, status, início e fim da vigência |
| `subscriptions` | apólice, próxima cobrança, status, ciclo |
| `payments` | assinatura, valor, método, status, id no gateway |
| `claims` | apólice, tipo de evento, descrição, status, franquia cobrada |
| `claim_documents` / `claim_events` | arquivos enviados e histórico de status |
| `tickets` / `ticket_messages` | assunto, status, mensagens |
| `faqs` / `feedbacks` | pergunta e resposta; nota e comentário |

Rotas por módulo (o grupo ajusta nomes):

| Módulo | Rotas |
| --- | --- |
| `auth` | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /me` |
| `plans` | `GET /plans`, `GET /plans/:id` |
| `quotes` | `POST /quotes`, `GET /quotes/:id` |
| `policies` | `POST /policies` (compra), `GET /policies`, `GET /policies/:id` |
| `payments` | `POST /payments`, `POST /payments/webhook` |
| `subscriptions` | `GET /subscriptions`, `POST /subscriptions/:id/cancel` |
| `claims` | `POST /claims`, `GET /claims`, `GET /claims/:id`, `POST /claims/:id/documents` |
| `support` | `GET /faqs`, `POST /tickets`, `GET /tickets`, `POST /tickets/:id/messages`, `POST /feedbacks` |

**Pronto quando:** o banco sobe do zero com migrations e seeds, o DER está no repositório e o Swagger lista todas as rotas do MVP.

## Fase 3 – Cotação com consulta de IMEI

**Objetivo:** um visitante sem conta informa o IMEI e vê os planos disponíveis com preço e franquia. É a porta de entrada do funil.

**Backend**

- [x] Validar o IMEI: 15 dígitos e dígito verificador (algoritmo de Luhn), sem chamar a API externa se for inválido.
- [x] Criar a interface `ImeiProvider` com duas implementações: `MockImeiProvider` (dados fixos, usado em desenvolvimento e testes) e uma implementação real.
- [ ] Escolher a API real de consulta de IMEI: comparar opções gratuitas ou de teste, limites de uso e o que retornam (marca, modelo, situação de bloqueio). Guardar a chave no `.env`. *(parcial: `HttpImeiProvider` genérico e configurável; nenhum fornecedor foi contratado, a demonstração usa o mock)*
- [x] Tratar falhas da API externa (timeout, erro, limite excedido) com mensagem clara ao usuário, e guardar consultas recentes em cache para economizar chamadas.
- [x] Definir elegibilidade: rejeitar aparelho bloqueado ou fora das regras do grupo (por exemplo, idade máxima).
- [x] Implementar o cálculo do preço e da franquia como função pura, com testes unitários cobrindo cada plano.
- [x] Criar `POST /quotes` (público) retornando a cotação com validade e os planos com preço; `GET /quotes/:id` para retomar depois.
- [x] Aplicar limite de requisições (`@nestjs/throttler`), já que a rota é pública e consome API externa.

**Frontend**

- [x] Tela de cotação: campo de IMEI com máscara e validação imediata, e dica de como descobrir o IMEI (discar `*#06#`).
- [x] Tela de resultado: comparação dos planos (preço mensal, coberturas, franquia) e botão "Contratar".
- [x] Guardar o `quoteId` para que o usuário retome a compra depois de entrar ou se cadastrar.
- [x] Estados de carregamento, erro e IMEI não aceito.

**Pronto quando:** um IMEI válido gera cotação com os planos e preços corretos; IMEI inválido, bloqueado ou erro da API mostram mensagens claras; os cálculos têm testes.

## Fase 4 – Cadastro e login

**Objetivo:** o cliente cria conta e entra com segurança, sem perder a cotação que já fez.

**Backend**

- [x] Cadastro (`POST /auth/register`): nome, e-mail único, CPF válido e único, telefone, senha com regra mínima e aceite dos termos e da política de privacidade (LGPD).
- [x] Guardar a senha apenas como hash (argon2 ou bcrypt), nunca em texto.
- [x] Login (`POST /auth/login`) com token de acesso JWT de vida curta e refresh token; o refresh token vai em cookie `httpOnly` ou é guardado como hash no banco, para poder ser revogado.
- [x] Guards de autenticação e de papel (`customer` e `admin`) e o endpoint `GET /me`.
- [x] Limite de tentativas no login e mensagens genéricas ("e-mail ou senha incorretos"), sem revelar se o e-mail existe.
- [x] Opcional: recuperação de senha por e-mail, usando um servidor SMTP de teste (Mailtrap ou similar).

**Frontend**

- [x] Telas de cadastro e login com validação (React Hook Form + Zod) e máscara de CPF e telefone.
- [x] Contexto de autenticação, rotas protegidas e renovação automática do token no interceptor.
- [x] Ao concluir o login, voltar para o ponto onde o usuário estava (por exemplo, a cotação salva).
- [x] Área logada básica: menu com "Minhas apólices", "Sinistros" e "Suporte" (as telas entram nas próximas fases).

**Pronto quando:** é possível cadastrar, entrar, sair e acessar uma rota protegida; rotas protegidas recusam quem não está logado; testes cobrem cadastro duplicado e senha errada.

## Fase 5 – Landing page: planos, coberturas, FAQ, feedback e suporte

**Objetivo:** uma página que explica o produto, converte o visitante em cotação e oferece suporte. Pode ser feita em paralelo à Fase 4, pois quase tudo é público.

**Página**

- [x] Seção inicial com a proposta de valor e o botão principal "Faça sua cotação", que leva à Fase 3.
- [x] Seção "Como funciona" em três ou quatro passos (cotar, contratar, usar, renovar).
- [x] Seção de planos e coberturas lida da API (`GET /plans`), mostrando o que cada plano cobre e a franquia. Nada fixo no código.
- [x] Seção de feedback: exibir avaliações aprovadas e permitir que cliente logado envie nota e comentário (`POST /feedbacks`).
- [x] Seção de dúvidas frequentes em formato sanfona, lida de `GET /faqs`.
- [x] Rodapé com links para termos, privacidade e contato.
- [x] Layout responsivo (celular primeiro), acessibilidade básica (contraste, foco de teclado, textos alternativos) e títulos de página para SEO.

**Suporte com tickets**

- [x] Formulário de abertura de ticket (assunto, categoria, mensagem). Decidam se exige login; recomendado exigir, para vincular à apólice.
- [x] Tela "Meus tickets" com status (`aberto`, `em andamento`, `resolvido`) e troca de mensagens dentro do ticket.
- [x] Visão mínima para o atendente (papel `admin`): listar tickets, responder e mudar o status. Pode ser simples, sem painel completo.
- [x] E-mail ao cliente quando o ticket receber resposta (pode usar o SMTP de teste).

**Pronto quando:** a página carrega planos, FAQ e feedbacks da API, o visitante chega à cotação em um clique, e um cliente logado abre um ticket que o admin consegue responder.

## Fase 6 – Compra e pagamento

**Objetivo:** transformar uma cotação em apólice ativa depois de um pagamento confirmado.

Fluxo: cotação → login → resumo e termos → pagamento → confirmação pelo gateway → apólice ativa.

**Backend**

- [x] Escolher o gateway e usar apenas o ambiente de testes (sandbox): Mercado Pago ou Stripe, com Pix e cartão.
- [x] Criar a interface `PaymentGateway` com uma implementação real e um mock, como foi feito com o IMEI.
- [x] `POST /policies`: recebe a cotação escolhida, confere se ela ainda está válida e cria a apólice como `aguardando_pagamento`, junto com a assinatura e a primeira cobrança.
- [x] Nunca receber nem guardar número de cartão no backend: usar checkout hospedado ou tokenização feita no frontend pelo SDK do gateway.
- [x] `POST /payments/webhook`: validar a assinatura do gateway, tratar o mesmo evento mais de uma vez sem duplicar efeito (idempotência) e atualizar pagamento e apólice.
- [x] Ao confirmar o pagamento, ativar a apólice, definir início e fim da vigência, aplicar a carência e agendar a próxima cobrança.
- [x] Impedir duas apólices ativas para o mesmo IMEI.
- [x] Enviar e-mail de confirmação com o resumo da apólice.

**Frontend**

- [x] Tela de checkout com resumo (aparelho, plano, preço, franquia), aceite dos termos e forma de pagamento.
- [x] Telas para os estados: processando, aprovado, recusado e Pix aguardando pagamento.
- [x] "Minhas apólices": lista e detalhe com coberturas, vigência e status.

**Como testar o webhook localmente:** use um túnel (por exemplo, ngrok) para o gateway alcançar sua máquina, ou crie uma rota apenas de desenvolvimento que simula a confirmação.

**Pronto quando:** com cartão ou Pix de teste, a compra termina com apólice ativa; pagamento recusado não ativa nada; reenviar o mesmo webhook não duplica nada.

## Fase 7 – Renovação, assinatura e franquia

**Objetivo:** a apólice se renova sozinha a cada ciclo, o cliente acompanha e cancela quando quiser, e as regras de franquia ficam claras.

**Renovação automática**

- [x] Criar uma rotina diária (`@nestjs/schedule`) que busca assinaturas com cobrança vencida ou a vencer e gera a nova cobrança.
- [x] Definir os estados da assinatura: `ativa`, `inadimplente`, `suspensa`, `cancelada`, e as transições entre eles.
- [x] Cobrança paga: estender a vigência e agendar a próxima. Cobrança falha: marcar `inadimplente`, tentar de novo conforme a regra do grupo e, esgotado o prazo, suspender ou cancelar a apólice.
- [x] Garantir que a rotina nunca cobre duas vezes o mesmo ciclo (idempotência por assinatura e ciclo).
- [x] Enviar e-mail de aviso alguns dias antes do vencimento e de cobrança recusada.
- [x] Injetar o relógio do sistema como dependência, para testes simularem datas futuras sem esperar.

**Assinatura**

- [x] `GET /subscriptions` e tela "Minha assinatura": próxima cobrança, histórico de pagamentos e status.
- [x] Cancelamento pelo cliente (`POST /subscriptions/:id/cancel`), definindo se a cobertura vale até o fim do ciclo pago.
- [x] Opcional: trocar de plano no próximo ciclo.

**Franquia**

- [x] Exibir na apólice a franquia de cada cobertura e como ela é calculada.
- [x] Implementar o cálculo da franquia como função pura, com testes, para ser usado no acionamento (Fase 8).
- [x] Definir quando a franquia é cobrada: no momento da aprovação do sinistro, antes da reposição ou do reparo.

**Pronto quando:** simulando a passagem do tempo nos testes, a apólice renova com pagamento aprovado, fica inadimplente e depois suspensa com pagamento recusado, e o cancelamento funciona.

## Fase 8 – Acionamento do seguro (sinistro)

**Objetivo:** o cliente aciona o seguro, acompanha a análise e chega ao desfecho (aprovado ou negado), com a franquia cobrada quando houver aprovação. É a fase mais complexa; façam por último e em partes.

**Regras de negócio a implementar**

- [x] Só é possível acionar com apólice ativa, fora da carência e com a cobertura incluída no plano.
- [x] Tipos de evento: roubo, furto, quebra de tela, dano por líquido (ajustem às coberturas definidas na Fase 0).
- [x] Documentos exigidos por tipo: por exemplo, boletim de ocorrência para roubo e furto, fotos do aparelho para dano.
- [x] Definir se há limite de acionamentos por vigência.

**Estados do sinistro**

| De | Para | Quem dispara |
| --- | --- | --- |
| (novo) | `aberto` | Cliente envia o acionamento |
| `aberto` | `em_analise` | Atendente começa a análise |
| `em_analise` | `aprovado` ou `negado` | Atendente decide, com motivo registrado |
| `aprovado` | `aguardando_franquia` | Sistema, ao gerar a cobrança da franquia |
| `aguardando_franquia` | `concluido` | Pagamento da franquia confirmado e reposição ou reparo encaminhado |

**Backend**

- [x] `POST /claims` com validações de elegibilidade e criação do primeiro evento no histórico.
- [x] Upload de documentos (`POST /claims/:id/documents`): limitar tipo e tamanho do arquivo, guardar fora da pasta pública e só entregar o arquivo a quem é dono ou admin.
- [x] Registrar toda mudança de status em `claim_events` (quem, quando, motivo).
- [x] Rotas de admin para iniciar análise, aprovar e negar, com e-mail de aviso ao cliente.
- [x] Cobrar a franquia reaproveitando o módulo de pagamentos da Fase 6; a confirmação via webhook conclui o sinistro.
- [x] O encaminhamento de reposição ou reparo pode ser apenas um registro no histórico, sem integração externa.

**Frontend**

- [x] Assistente de abertura em passos: escolher a apólice, tipo de evento, data, local e descrição, e enviar documentos.
- [x] Tela de acompanhamento com a linha do tempo dos eventos e o status atual.
- [x] Pagamento da franquia quando o sinistro estiver aprovado.
- [x] Visão do admin: lista de sinistros, detalhe com documentos e botões de aprovar e negar.

**Pronto quando:** um cliente com apólice ativa abre um sinistro, o admin aprova, a franquia é paga e o sinistro chega a `concluido`; casos sem direito (apólice suspensa, em carência, cobertura não contratada) são barrados com mensagem clara.

## Fase 9 – Testes, segurança e polimento

**Objetivo:** congelar funcionalidades novas e deixar o que existe confiável e apresentável.

**Testes**

- [x] Testes unitários das regras críticas: validação de IMEI, cálculo de preço e franquia, transições de status.
- [x] Testes de integração do backend (Jest + Supertest) cobrindo o caminho completo: cotação, cadastro, compra, webhook, renovação e sinistro.
- [x] Testes de componentes no frontend (Vitest + Testing Library) para formulários principais.
- [x] Um teste ponta a ponta (Playwright ou Cypress) do caminho feliz: cotar, comprar e acionar.
- [ ] Rodada de teste manual em grupo: cada pessoa testa o fluxo que não escreveu e registra os bugs no quadro. *(não se aplica: sem grupo; substituído pelos testes automatizados e pelo E2E)*

**Segurança (lista mínima)**

- [x] Autorização por dono do recurso: um cliente nunca acessa apólice, sinistro, ticket ou arquivo de outro cliente.
- [x] Validação de todos os dados de entrada nos DTOs e `helmet` ativo; CORS restrito à origem do frontend.
- [x] Limite de requisições nas rotas públicas e no login.
- [x] Segredos só em variáveis de ambiente, nunca no repositório; revisar o histórico do Git em busca de chaves vazadas.
- [x] Logs sem senha, token ou documentos; coletar apenas os dados pessoais necessários (LGPD).

**Polimento**

- [x] Estados de carregamento, erro e lista vazia em todas as telas.
- [x] Mensagens de erro compreensíveis para o usuário, sem detalhes técnicos.
- [x] Revisão de responsividade em celular e de acessibilidade básica.
- [x] Índices no banco para as consultas mais usadas e paginação nas listas.
- [x] Dados de demonstração (seed) que mostrem o produto funcionando: clientes, apólices em estados diferentes e sinistros em andamento.

**Pronto quando:** a CI passa, o caminho completo roda sem erro do início ao fim e não há bug crítico aberto no quadro.

## Fase 10 – Documentação, deploy e apresentação

**Objetivo:** entregar o projeto bem explicado, acessível para quem avalia e apresentado com segurança.

**Documentação**

- [x] README completo: o que é o projeto, como rodar (com `docker compose`), variáveis de ambiente, como rodar os testes e como acessar o Swagger.
- [x] Documento para a faculdade, ajustado ao que o professor pediu: visão do negócio, requisitos funcionais e não funcionais, user stories, DER, diagrama de arquitetura, diagramas de sequência dos fluxos principais (compra e acionamento), decisões técnicas, limitações e trabalhos futuros.
- [ ] Prints ou um vídeo curto de cada funcionalidade para anexar. *(pendente: gravar com o sistema rodando)*

**Deploy (se for exigido ou para facilitar a avaliação)**

- [ ] Publicar o frontend, o backend e o MySQL em provedores com plano gratuito ou para estudantes. *(não se aplica: sem deploy, a pedido)*
- [ ] Configurar as variáveis de ambiente de produção, rodar as migrations e os seeds e manter o gateway de pagamento em modo de testes. *(não se aplica: sem deploy, a pedido)*
- [ ] Testar o fluxo completo no ambiente publicado, inclusive o webhook com a URL pública. *(não se aplica: sem deploy, a pedido)*
- [ ] Plano B para a apresentação: o sistema rodando localmente via `docker compose` e um vídeo gravado da demonstração. *(parcial: roda localmente via `docker compose` ou `npm run db:local`; vídeo pendente)*

**Apresentação**

- [ ] Roteiro: problema e público, solução, demonstração ao vivo (cotar, comprar, renovar, acionar), arquitetura e stack, desafios e aprendizados, próximos passos. *(não se aplica: apresentação desconsiderada)*
- [ ] Dividir as falas entre todos os membros e cronometrar. *(não se aplica: apresentação desconsiderada)*
- [ ] Preparar os dados da demonstração com antecedência e fazer pelo menos dois ensaios completos, um deles simulando falha de internet. *(parcial: `npm run db:seed:demo` cria os dados; ensaios não se aplicam)*
- [ ] Revisão final de entrega: repositório organizado, documentos no formato pedido, links funcionando, acesso concedido ao professor. *(não se aplica: entrega ao professor desconsiderada)*

**Pronto quando:** alguém de fora do grupo consegue rodar ou acessar o sistema seguindo apenas o README, e o grupo apresenta a demonstração completa sem depender de improviso.

## Rotina da equipe, riscos e plano de corte de escopo

**Rotina sugerida**

- Reunião curta uma ou duas vezes por semana: o que foi feito, o que vai ser feito, o que está travado.
- Pull Requests pequenos e revisados em até um dia; ninguém faz merge do próprio código sem revisão.
- Ao fim de cada fase, uma demonstração rápida para o grupo, usando o critério de "pronto" da fase.
- Integrar sempre: entregar fatias completas (tela, rota e banco juntos) em vez de deixar todo o backend para depois integrar com o frontend.
- Duplas em tarefas críticas (pagamento, acionamento), para que ninguém seja ponto único de falha.

**Riscos e respostas**

| Risco | O que fazer |
| --- | --- |
| API de IMEI paga, instável ou com limite baixo | Usar a interface `ImeiProvider` com mock; apresentar com o mock se preciso |
| Webhook difícil de testar localmente | Túnel (ngrok) ou rota de simulação só em desenvolvimento |
| Escopo maior que o tempo disponível | Aplicar o plano de corte abaixo, na ordem |
| Conflitos de merge e código que não integra | Branches curtas, PRs pequenos, CI obrigatória |
| Integração deixada para o final | Contrato da API na Fase 2 e entregas em fatias completas |
| Membro indisponível | Documentar decisões, trabalhar em duplas e manter o quadro atualizado |

**Plano de corte de escopo**

Se o tempo apertar, cortem nesta ordem, do que dói menos para o que dói mais:

1. Recuperação de senha, troca de plano e e-mails automáticos.
2. Painel de admin dedicado; usar rotas protegidas e dados de seed para a demonstração.
3. Upload de documentos no sinistro; manter apenas descrição em texto.
4. Renovação automática real; manter um botão ou comando que simula a passagem do ciclo para a demonstração.
5. Deploy publicado; apresentar rodando localmente.

O que **não** deve ser cortado, porque é o núcleo do produto: cotação, cadastro e login, compra com pagamento em modo de testes, e acionamento básico (abrir e acompanhar).
