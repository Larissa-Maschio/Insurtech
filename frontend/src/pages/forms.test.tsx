import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from '../test/http'
import { RegisterPage } from './auth/AuthPages'
import { QuotePage } from './QuotePage'
import { renderPage } from '../test/utils'

describe('Tela de cotação', () => {
  beforeEach(() => {
    http.reset()
    http.on('POST', '/api/auth/refresh', 401, { code: 'SESSAO_EXPIRADA' })
  })

  it('valida o IMEI na hora, sem chamar a API', async () => {
    const user = userEvent.setup()
    renderPage(<QuotePage />)
    const input = screen.getByLabelText('IMEI do aparelho')
    await user.type(input, '350000011234561')
    await user.tab()
    expect(await screen.findByText('IMEI inválido: confira os números digitados')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver planos' }))
    expect(http.calls('POST', '/api/quotes')).toBe(0)
  })

  it('aplica a máscara e envia só os dígitos; em sucesso vai para o resultado', async () => {
    http.on('POST', '/api/quotes', 201, { id: 'q1' })
    const user = userEvent.setup()
    renderPage(<QuotePage />)
    const input = screen.getByLabelText('IMEI do aparelho')
    await user.type(input, '350000011234560')
    expect(input).toHaveValue('35-000001-123456-0')
    await user.click(screen.getByRole('button', { name: 'Ver planos' }))
    expect(await screen.findByText('Resultado da cotação')).toBeInTheDocument()
    expect(http.lastBody('POST', '/api/quotes')).toEqual({ imei: '350000011234560' })
  })

  it('mostra a mensagem da API quando o aparelho é recusado', async () => {
    http.on('POST', '/api/quotes', 422, { code: 'APARELHO_BLOQUEADO', message: 'Este aparelho consta como bloqueado.' })
    const user = userEvent.setup()
    renderPage(<QuotePage />)
    await user.type(screen.getByLabelText('IMEI do aparelho'), '359999991234568')
    await user.click(screen.getByRole('button', { name: 'Ver planos' }))
    expect(await screen.findByText('Aparelho com restrição')).toBeInTheDocument()
    expect(screen.getByText('Este aparelho consta como bloqueado.')).toBeInTheDocument()
  })
})

describe('Tela de cadastro', () => {
  beforeEach(() => {
    http.reset()
    http.on('POST', '/api/auth/refresh', 401, { code: 'SESSAO_EXPIRADA' })
  })

  it('mostra erros de validação e não envia o formulário inválido', async () => {
    const user = userEvent.setup()
    renderPage(<RegisterPage />)
    await screen.findByRole('button', { name: 'Criar conta' })
    await user.type(screen.getByLabelText('CPF'), '11111111111')
    await user.type(screen.getByLabelText('Senha'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('CPF inválido')).toBeInTheDocument()
    expect(screen.getByText('A senha precisa ter pelo menos 8 caracteres')).toBeInTheDocument()
    expect(screen.getByText(/É preciso aceitar os termos/)).toBeInTheDocument()
    expect(http.calls('POST', '/api/auth/register')).toBe(0)
  })

  it('envia CPF e telefone sem máscara e entra na área do cliente', async () => {
    http.on('POST', '/api/auth/register', 201, {
      accessToken: 'tok',
      user: {
        id: '1',
        name: 'Maria Souza',
        email: 'maria@teste.com',
        cpf: '52998224725',
        phone: '11987654321',
        role: 'CUSTOMER',
      },
    })
    const user = userEvent.setup()
    renderPage(<RegisterPage />)
    await screen.findByRole('button', { name: 'Criar conta' })
    await user.type(screen.getByLabelText('Nome completo'), 'Maria Souza')
    await user.type(screen.getByLabelText('E-mail'), 'maria@teste.com')
    await user.type(screen.getByLabelText('CPF'), '52998224725')
    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-25')
    await user.type(screen.getByLabelText('Celular'), '11987654321')
    await user.type(screen.getByLabelText('Senha'), 'senhaSegura1')
    await user.type(screen.getByLabelText('Confirme a senha'), 'senhaSegura1')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    await waitFor(() => expect(screen.getByText('Área do cliente')).toBeInTheDocument())
    expect(http.lastBody('POST', '/api/auth/register')).toMatchObject({
      cpf: '52998224725',
      phone: '11987654321',
      acceptTerms: true,
    })
  })
})
