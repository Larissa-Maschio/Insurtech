# User stories – Seguradora de Celular

> **Aprovado** em 18/11/2026 (Fase 0). Implementado conforme descrito; ver [documento do projeto](documento-do-projeto.md).
> Prioridade: **M** = obrigatório (núcleo) · **D** = desejável (pode ser cortado pelo plano de corte).

## F1 – Cotação com consulta de IMEI (Fase 3)

**US01 (M)** – Como visitante, quero informar o IMEI do meu celular para ver os planos disponíveis sem criar conta.
- [ ] O campo só aceita dígitos e mostra uma dica de como achar o IMEI (`*#06#`).
- [ ] Um IMEI inválido (tamanho ou Luhn) mostra erro na hora, sem chamar o servidor externo.
- [ ] Com IMEI válido e aparelho elegível, aparecem marca, modelo, valor de referência e os 3 planos com preço mensal (RN02), coberturas (RN01) e franquias (RN03).
- [ ] Aparelho bloqueado, fora da faixa de valor ou antigo demais mostra o motivo da recusa (RN04).
- [ ] Se a consulta externa falhar, aparece uma mensagem clara e a opção de tentar de novo.

**US02 (M)** – Como visitante, quero que minha cotação fique salva para continuar a compra depois de entrar ou me cadastrar.
- [ ] A cotação tem um identificador e validade de 7 dias (RN05).
- [ ] Depois do login ou cadastro, o usuário volta direto para o resumo da cotação escolhida.
- [ ] Uma cotação vencida mostra o aviso e o botão "Cotar novamente".

## F2 – Cadastro e login (Fase 4)

**US03 (M)** – Como visitante, quero criar uma conta para contratar o seguro.
- [ ] O formulário pede nome, e-mail, CPF, telefone e senha, com máscara e validação (RN11).
- [ ] Um e-mail ou CPF já cadastrado mostra mensagem de erro, e a conta não é criada.
- [ ] Não dá para concluir o cadastro sem aceitar os termos e a política de privacidade.

**US04 (M)** – Como cliente, quero entrar e sair da minha conta com segurança.
- [ ] Credenciais erradas mostram "e-mail ou senha incorretos", sem revelar qual dos dois está errado.
- [ ] Depois de várias tentativas seguidas, o login é bloqueado temporariamente.
- [ ] A sessão se renova sozinha enquanto o cliente usa o sistema, e "Sair" encerra a sessão.
- [ ] Quem não está logado e tenta abrir uma página protegida é levado para o login.

**US05 (D)** – Como cliente, quero recuperar minha senha por e-mail.
- [ ] O link de redefinição expira em 1 hora e só pode ser usado uma vez.

## F3 – Landing page (Fase 5)

**US06 (M)** – Como visitante, quero entender o produto e chegar à cotação com um clique.
- [ ] A página tem proposta de valor, "Como funciona" (cotar, contratar, usar, renovar) e o botão "Faça sua cotação".
- [ ] Planos e coberturas vêm da API, sem nada fixo no código.
- [ ] O layout funciona no celular e no desktop, com contraste, foco de teclado e textos alternativos.

**US07 (M)** – Como visitante, quero ler as perguntas frequentes para tirar dúvidas sozinho.
- [ ] As perguntas vêm da API e aparecem em formato sanfona.

**US08 (D)** – Como cliente, quero avaliar o serviço, e como visitante, quero ver avaliações de outros clientes.
- [ ] Só cliente com apólice consegue enviar nota (1 a 5) e comentário (RN12).
- [ ] Só avaliações aprovadas pelo admin aparecem na página.

## F4 – Suporte com tickets (Fase 5)

**US09 (M)** – Como cliente, quero abrir um ticket de suporte e acompanhar a resposta.
- [ ] O formulário tem assunto, categoria (RN12) e mensagem, e pode ser ligado a uma apólice.
- [ ] Em "Meus tickets" aparecem os tickets com status (`aberto`, `em andamento`, `resolvido`) e as mensagens trocadas.
- [ ] O cliente recebe um e-mail quando o ticket é respondido (D).

**US10 (M)** – Como atendente (admin), quero listar, responder e mudar o status dos tickets.
- [ ] O admin vê todos os tickets e filtra por status.
- [ ] O cliente não vê tickets de outros clientes.

## F5 – Compra e pagamento (Fase 6)

**US11 (M)** – Como cliente, quero revisar e pagar a cotação escolhida para ativar meu seguro.
- [ ] O resumo mostra aparelho, plano, preço mensal, coberturas, franquias e carências (RN07), além do aceite dos termos.
- [ ] O pagamento é feito por Pix ou cartão no sandbox do gateway, e o número do cartão nunca passa pelo nosso backend.
- [ ] Com o pagamento aprovado, a apólice fica `ativa`, com início e fim da vigência, e o cliente recebe um e-mail de confirmação.
- [ ] Com o pagamento recusado, nada é ativado e o cliente pode tentar de novo.
- [ ] Enquanto o Pix não é pago, a tela mostra o QR Code e o status "aguardando pagamento".
- [ ] Não dá para contratar se o IMEI já tiver apólice ativa (RN04).

**US12 (M)** – Como cliente, quero ver minhas apólices e o detalhe de cada uma.
- [ ] A lista mostra aparelho, plano, status e vigência.
- [ ] O detalhe mostra coberturas, franquia de cada cobertura e quando a carência termina.

## F6 – Renovação, assinatura e franquia (Fase 7)

**US13 (M)** – Como cliente, quero que meu seguro seja renovado automaticamente todo mês.
- [ ] A cobrança é gerada antes do vencimento (RN06), e cada ciclo é cobrado uma única vez.
- [ ] Com o pagamento aprovado, a vigência é estendida por mais um ciclo.
- [ ] Com o pagamento recusado, a assinatura segue a régua de inadimplência (RN08) e o cliente é avisado por e-mail.

**US14 (M)** – Como cliente, quero acompanhar minha assinatura e cancelá-la quando quiser.
- [ ] A tela mostra a próxima cobrança, o histórico de pagamentos e o status.
- [ ] O cancelamento pede confirmação, e a cobertura continua até o fim do ciclo pago (RN09).

**US15 (D)** – Como cliente, quero trocar de plano a partir do próximo ciclo.

## F7 – Acionamento do seguro (Fase 8)

**US16 (M)** – Como cliente, quero acionar o seguro quando algo acontecer com meu celular.
- [ ] Um assistente em passos pede apólice, tipo de evento, data, local, descrição e documentos (RN10).
- [ ] Apólice suspensa ou cancelada, carência em curso, cobertura fora do plano, limite de sinistros atingido ou evento comunicado fora do prazo bloqueiam o pedido com mensagem clara.
- [ ] Arquivos com tipo ou tamanho fora do permitido são recusados.

**US17 (M)** – Como cliente, quero acompanhar a análise do meu sinistro.
- [ ] Uma linha do tempo mostra cada mudança de status, com data e motivo.
- [ ] Quando o sinistro é aprovado, aparece o valor da franquia e o botão para pagá-la. Depois do pagamento, o sinistro fica `concluido`.
- [ ] Quando é negado, aparece o motivo.

**US18 (M)** – Como atendente (admin), quero analisar sinistros e decidir pela aprovação ou negativa.
- [ ] O admin vê a lista de sinistros por status e o detalhe com os documentos.
- [ ] Pode iniciar a análise, aprovar ou negar, sempre informando um motivo, que fica registrado no histórico.
- [ ] O cliente é avisado por e-mail a cada decisão (D).
- [ ] Só o dono do sinistro e os admins conseguem baixar os documentos.

## Aprovação
| Membro | Aprovado? | Ajustes pedidos |
|--------|-----------|-----------------|
|        | [ ]       |                 |
|        | [ ]       |                 |
|        | [ ]       |                 |
|        | [ ]       |                 |
