# Processo do grupo – Seguradora de Celular

> Modelo de processo de equipe. Papéis, critérios de avaliação e prazos foram desconsiderados neste projeto; as regras de fluxo de código abaixo estão automatizadas (Husky, commitlint, CI).

## Papéis
Todos podem mexer em tudo, mas cada área tem um responsável.

| Área | Responsável | Apoio |
|------|-------------|-------|
| Backend (NestJS, regras, integrações) | | |
| Frontend (React, telas, UX) | | |
| Banco e infraestrutura (MySQL, Docker, CI, deploy) | | |
| Documentação e testes | | |

Duplas em tarefas críticas: **Pagamento** (Fase 6) = ___ + ___ · **Sinistro** (Fase 8) = ___ + ___

## Ferramentas
- Quadro de tarefas: [ ] GitHub Projects  [ ] Trello. Colunas: Backlog → A fazer → Em andamento → Em revisão → Pronto.
- Canal de comunicação: ______
- Reuniões: ___ vez(es) por semana, em ___ (o que foi feito, o que vai ser feito, o que está travado).

## Exigências do professor (confirmar)
- [ ] Documentos exigidos e formato:
- [ ] Formato e duração da apresentação:
- [ ] O deploy é obrigatório? [ ] sim  [ ] não
- [ ] Critérios de avaliação:
- [ ] Data de entrega:

## Definição de "pronto"
Uma tarefa só está **pronta** quando:
1. funciona no ambiente local;
2. tem ao menos um teste básico;
3. foi revisada e aprovada por outra pessoa no Pull Request;
4. foi mesclada na `main` com a CI passando.

## Fluxo de código e revisão
- A `main` é protegida: nada de push direto.
- Branches no formato `feature/nome-da-tarefa` ou `fix/nome-do-bug`, de vida curta.
- Commits convencionais: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- Pull Requests pequenos, com descrição do que mudou, como testar e prints quando houver tela.
- Revisão em até 1 dia útil, e pelo menos 1 aprovação de outra pessoa. Ninguém faz merge do próprio PR sem revisão.
- O revisor confere: se atende aos critérios de aceite da user story, se tem teste, se não há segredo no código e se segue o contrato da API.
- Ao fim de cada fase, uma demonstração rápida para o grupo, usando o critério de "pronto" da fase.
