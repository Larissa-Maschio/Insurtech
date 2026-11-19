# Escopo do MVP – Seguradora de Celular

> **Aprovado** em 18/11/2026 (Fase 0). Implementado conforme descrito; ver [documento do projeto](documento-do-projeto.md).

## Problema e proposta
Quem perde, quebra ou tem o celular roubado arca sozinho com um custo alto. O produto é um SaaS em que a pessoa faz a cotação pelo IMEI em poucos segundos e contrata online um seguro mensal, que se renova sozinho. Quando precisar, aciona o seguro pela mesma plataforma.

**Público:** pessoas físicas com smartphone de valor médio ou alto, que preferem contratar e resolver tudo online.

## O que está no MVP (7 funcionalidades)

| # | Funcionalidade | Resumo | Fase |
|---|----------------|--------|------|
| 1 | Cotação com consulta de IMEI | Visitante informa o IMEI e vê planos com preço e franquia | 3 |
| 2 | Cadastro e login | Conta com CPF, login seguro, área logada | 4 |
| 3 | Landing page | Proposta de valor, planos e coberturas, FAQ, feedbacks | 5 |
| 4 | Suporte com tickets | Cliente abre ticket e troca mensagens; admin responde | 5 |
| 5 | Compra e pagamento | Cotação vira apólice ativa após pagamento (Pix/cartão em sandbox) | 6 |
| 6 | Renovação, assinatura e franquia | Cobrança mensal automática, inadimplência, cancelamento, franquia clara | 7 |
| 7 | Acionamento do seguro (sinistro) | Abrir, enviar documentos, acompanhar, admin aprova/nega, pagar franquia | 8 |

## Fora do escopo
- Aplicativo mobile nativo (o site é responsivo, pensado primeiro para celular).
- Painel administrativo completo: o admin tem só as telas mínimas de tickets e sinistros.
- Pagamentos reais: o gateway fica sempre em modo de testes (sandbox).
- Integração real com assistência técnica ou logística de reposição: fica só registrada no histórico.
- Vistoria do aparelho por foto ou vídeo na contratação.
- Seguro para outros aparelhos (tablet, notebook, relógio) e mais de um aparelho por apólice.
- Emissão de nota fiscal e integrações com SUSEP ou resseguradora.
- Programa de indicação, cupons e descontos.

## Premissas
- O valor do aparelho vem de uma **tabela de referência de modelos** (seed), cruzada com a marca e o modelo devolvidos pela consulta de IMEI.
- Se a API de IMEI não estiver disponível, a demonstração usa o `MockImeiProvider`.
- Ver as regras de negócio em [regras-de-negocio.md](regras-de-negocio.md) e as histórias de usuário em [user-stories.md](user-stories.md).

## Núcleo que não pode ser cortado
Cotação, cadastro e login, compra com pagamento em sandbox e acionamento básico (abrir e acompanhar). Se faltar tempo, aplicar o plano de corte do guia, na ordem em que aparece lá.

## Aprovação
| Membro | Aprovado? | Observações |
|--------|-----------|-------------|
|        | [ ]       |             |
|        | [ ]       |             |
|        | [ ]       |             |
|        | [ ]       |             |
