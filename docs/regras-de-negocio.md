# Regras de negócio – Seguradora de Celular

> **Aprovado** em 18/11/2026 (Fase 0). Implementado conforme descrito; ver [documento do projeto](documento-do-projeto.md).
> Convenções: valores em centavos no sistema; percentuais sempre calculados sobre o **valor de referência do aparelho**.

## RN01 – Planos e coberturas

| Cobertura | Básico | Intermediário | Premium |
|-----------|:------:|:-------------:|:-------:|
| Roubo (com violência ou ameaça) | ✅ | ✅ | ✅ |
| Furto qualificado (arrombamento) | ✅ | ✅ | ✅ |
| Quebra acidental (tela e corpo) | — | ✅ | ✅ |
| Dano por líquido | — | — | ✅ |
| Furto simples (sem vestígio) | — | — | ✅ |

## RN02 – Preço mensal
`preço mensal = valor do aparelho × taxa mensal do plano`, arredondado para cima em centavos, com **mínimo de R$ 19,90**.

| Plano | Taxa mensal |
|-------|-------------|
| Básico | 0,9% |
| Intermediário | 1,3% |
| Premium | 1,8% |

Exemplo: aparelho de R$ 4.000,00 → Básico R$ 36,00 · Intermediário R$ 52,00 · Premium R$ 72,00.

## RN03 – Franquia (paga pelo cliente ao acionar)

| Cobertura | Básico | Intermediário | Premium |
|-----------|--------|---------------|---------|
| Roubo / furto qualificado | 25% | 20% | 15% |
| Quebra acidental | — | 20% | 15% |
| Dano por líquido | — | — | 20% |
| Furto simples | — | — | 30% |

Exemplo: aparelho de R$ 4.000,00, plano Premium, quebra de tela → franquia de R$ 600,00.

## RN04 – Elegibilidade do aparelho (cotação)
- O IMEI precisa ter 15 dígitos e passar no algoritmo de Luhn. Se for inválido, a API externa não é consultada.
- O aparelho não pode estar bloqueado ou com restrição (roubo/perda) na consulta.
- O modelo precisa estar na tabela de referência, com valor entre **R$ 800,00 e R$ 15.000,00**.
- O modelo pode ter sido lançado há no máximo **3 anos**.
- Não pode haver apólice ativa, aguardando pagamento ou inadimplente para o mesmo IMEI.

## RN05 – Validade da cotação
A cotação vale **7 dias**. Depois disso, o cliente precisa cotar de novo, porque preço e elegibilidade podem ter mudado.

## RN06 – Vigência e ciclo
- A assinatura é **mensal** e a apólice cobre o período pago.
- A vigência começa quando o pagamento é confirmado e cada ciclo dura 1 mês.
- A cobrança de renovação é gerada **3 dias antes** do fim do ciclo, e o e-mail de aviso sai **5 dias antes**.

## RN07 – Carência
| Cobertura | Carência |
|-----------|----------|
| Roubo / furto qualificado | 7 dias |
| Quebra acidental, dano por líquido, furto simples | 30 dias |

A carência conta a partir do início da **primeira** vigência e não reinicia nas renovações.

## RN08 – Inadimplência
| Dia após o vencimento | Ação |
|-----------------------|------|
| 0 | Cobrança recusada → assinatura `inadimplente` e e-mail ao cliente |
| 3 e 7 | Nova tentativa de cobrança |
| 10 | Assinatura `suspensa`: não dá para abrir sinistro |
| 30 | Assinatura e apólice `canceladas` |

Se o pagamento sair em qualquer momento antes do dia 30, a assinatura volta a `ativa`, sem nova carência.

## RN09 – Cancelamento pelo cliente
- O cliente pode cancelar a qualquer momento pela área logada.
- A cobertura vale até o **fim do ciclo já pago**, sem reembolso proporcional.
- Sinistros abertos antes do cancelamento continuam seguindo o fluxo normal.

## RN10 – Sinistro
- Para acionar, a apólice precisa estar `ativa`, fora da carência daquela cobertura, e a cobertura precisa estar no plano.
- O evento tem que ter acontecido durante a vigência e ser comunicado em até **30 dias**.
- Limite: **2 sinistros a cada 12 meses** por apólice.
- Roubo ou furto aprovado e concluído **encerra a apólice**, porque o aparelho é substituído. Para segurar o novo aparelho, é preciso fazer uma nova cotação.
- A franquia é cobrada **depois da aprovação e antes** da reposição ou do reparo. O sinistro só fica `concluido` quando ela é paga.

Documentos exigidos:
| Evento | Documentos |
|--------|-----------|
| Roubo / furto | Boletim de ocorrência + documento com foto |
| Quebra acidental / dano por líquido | Fotos do aparelho (mín. 2) + descrição |

Arquivos aceitos: JPG, PNG e PDF, com até 5 MB cada e no máximo 5 por sinistro.

## RN11 – Cadastro
- Um CPF válido e único por conta, e um e-mail único.
- Senha com no mínimo 8 caracteres, contendo letra e número.
- Aceite obrigatório dos termos de uso e da política de privacidade (LGPD), guardando a data do aceite.

## RN12 – Suporte e feedback
- Abrir ticket exige login, para o ticket ficar ligado ao cliente e, se houver, à apólice.
- Categorias do ticket: Cotação, Pagamento, Apólice, Sinistro, Outros.
- Só clientes com apólice (ativa ou já encerrada) podem enviar feedback, com nota de 1 a 5 e comentário opcional. O feedback só aparece na landing page depois que um admin aprova.

## Aprovação
| Membro | Aprovado? | Ajustes pedidos |
|--------|-----------|-----------------|
|        | [ ]       |                 |
|        | [ ]       |                 |
|        | [ ]       |                 |
|        | [ ]       |                 |
