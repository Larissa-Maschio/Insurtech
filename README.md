# 📱 Insurtech - Seguro Celular

O **Insurtech** é uma aplicação completa para a gestão e contratação de seguros para smartphones. A plataforma permite desde a cotação rápida do aparelho via consulta de IMEI até o acionamento de sinistros e gestão de assinaturas.

---

## 🚀 Fluxo e Funcionalidades

O projeto é estruturado nos seguintes fluxos principais:

1. **Cotação de Seguro:** Consulta do IMEI via API dedicada para calcular a cobertura e os valores do plano.
2. **Cadastro:** Registro simples e seguro de novos usuários na plataforma.
3. **Autenticação:** Sistema de login seguro para clientes e administradores.
4. **Landing Page (LP):** 
   - Detalhamento dos planos e coberturas disponíveis.
   - Depoimentos e feedback de clientes.
   - FAQ (Dúvidas frequentes).
   - Suporte ao cliente com abertura de tickets.
5. **Compra e Pagamento:** Checkout integrado para adesão do plano escolhido.
6. **Renovação:** Gestão de assinaturas recorrentes e controle de franquia.
7. **Acionamento do Seguro:** Abertura rápida de solicitações em caso de roubo, furto ou danos ao aparelho.

---

## 🛠️ Stack Tecnológica

- **Linguagem:** TypeScript
- **Front-end:** React
- **Back-end:** NestJS
- **Banco de Dados:** MySQL

---

## ⚙️ Como Executar o Projeto

### Pré-requisitos
- Node.js (versão 18 ou superior)
- MySQL configurado e em execução
- Gerenciador de pacotes (`npm` ou `yarn`)

### Configuração

1. **Clonar o repositório:**
   ```bash
   git clone https://github.com/seu-usuario/insurtech.git
   cd insurtech
   ```

2. **Configurar variáveis de ambiente:**
   Crie um arquivo `.env` na raiz do projeto com as credenciais do banco de dados e APIs externas (ex: consulta de IMEI).

3. **Instalar dependências e iniciar o Servidor (Back-end):**
   ```bash
   cd backend
   npm install
   npm run start:dev
   ```

4. **Instalar dependências e iniciar a Aplicação (Front-end):**
   ```bash
   cd frontend
   npm install
   npm start
   ```

---

## 📄 Responsáveis

    André Bastos dos Santos
    André Filipi da Silveira de Sousa
    Larissa da Silva Maschio
    Pedro Henrique Gomes dos Santos

