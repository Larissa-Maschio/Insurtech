import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const ADMIN = { email: 'admin@seguradora.local', password: 'Admin@12345' }

/** IMEI válido (Luhn) e único, com TAC do Galaxy S25 no provedor mock. */
function uniqueImei() {
  const base = '35000004' + String(Date.now()).slice(-6)
  for (let d = 0; d <= 9; d++) {
    const imei = base + d
    let sum = 0
    for (let i = 0; i < 15; i++) {
      let x = Number(imei[14 - i])
      if (i % 2 === 1) {
        x *= 2
        if (x > 9) x -= 9
      }
      sum += x
    }
    if (sum % 10 === 0) return imei
  }
  throw new Error('unreachable')
}

function randomCpf() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  const dv = (len: number) => {
    let s = 0
    for (let i = 0; i < len; i++) s += n[i] * (len + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  n.push(dv(9))
  n.push(dv(10))
  return n.join('')
}

// Reaproveita o token do admin (o login tem limite de 5 tentativas por minuto).
let adminHeaders: Record<string, string> | null = null
async function adminApi(request: APIRequestContext) {
  if (!adminHeaders) {
    const res = await request.post('/api/auth/login', { data: ADMIN })
    expect(res.ok()).toBeTruthy()
    adminHeaders = { Authorization: `Bearer ${(await res.json()).accessToken}` }
  }
  return adminHeaders
}

async function chooseOption(page: Page, label: string | RegExp, option: string | RegExp) {
  await page.getByLabel(label).click()
  await page.getByRole('option', { name: option }).click()
}

test.afterAll(async ({ request }) => {
  await request.post('/api/dev/clock/reset', { headers: await adminApi(request) })
})

test('caminho feliz: cotar, contratar, acionar e concluir o sinistro', async ({ page, browser, request }) => {
  const email = `e2e.${Date.now()}@teste.com`

  // 1. Landing → cotação
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Seu celular protegido')
  await expect(page.getByTestId('health')).toContainText('Sistema online')
  await expect(page.getByRole('heading', { name: 'Premium' })).toBeVisible()
  await page.getByRole('link', { name: 'Faça sua cotação' }).first().click()

  // 2. IMEI inválido mostra erro na hora; válido mostra os planos
  const imeiField = page.getByLabel('IMEI do aparelho')
  await imeiField.fill('350000041234560')
  await imeiField.blur()
  await expect(page.getByText('IMEI inválido: confira os números digitados')).toBeVisible()
  await imeiField.fill(uniqueImei())
  await page.getByRole('button', { name: 'Ver planos' }).click()
  await expect(page.getByRole('heading', { name: /Samsung Galaxy S25/ })).toBeVisible()
  await expect(page.getByText('R$ 98,99')).toBeVisible() // Premium: 5.499,00 × 1,8%

  // 3. Contratar sem conta → cadastro → volta para a contratação
  await page.getByRole('link', { name: 'Contratar Premium' }).click()
  await expect(page).toHaveURL(/\/entrar/)
  await page.getByRole('link', { name: 'Criar conta' }).click()
  await page.getByLabel('Nome completo').fill('Cliente E2E Teste')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('CPF').fill(randomCpf())
  await page.getByLabel('Celular').fill('11987654321')
  await page.getByLabel('Senha', { exact: true }).fill('senhaSegura1')
  await page.getByLabel('Confirme a senha').fill('senhaSegura1')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()

  // 4. Checkout com Pix e confirmação simulada do gateway
  await expect(page.getByRole('heading', { name: 'Revisar e contratar' })).toBeVisible()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /^Pagar R\$/ }).click()
  await expect(page.getByText('Aguardando o pagamento do Pix')).toBeVisible()
  await expect(page.getByLabel('QR Code do Pix')).toBeVisible()
  await page.getByRole('link', { name: /simular pagamento do Pix/ }).click()
  await page.getByRole('button', { name: 'Aprovar pagamento' }).click()
  await expect(page.getByText('Pagamento aprovado!')).toBeVisible()
  await page.getByRole('link', { name: 'Ver minha apólice' }).click()
  await expect(page.getByText('Ativa', { exact: true })).toBeVisible()

  // 5. Passam 8 dias (fim da carência de roubo) → aciona o seguro
  const admin = await adminApi(request)
  const advanced = await (await request.post('/api/dev/clock/advance', { headers: admin, data: { days: 8 } })).json()
  const occurred = new Date(new Date(advanced.now).getTime() - 2 * 3600e3) // 2 h antes do "agora" simulado
  const pad = (n: number) => String(n).padStart(2, '0')
  const local = `${occurred.getFullYear()}-${pad(occurred.getMonth() + 1)}-${pad(occurred.getDate())}T${pad(occurred.getHours())}:${pad(occurred.getMinutes())}`
  await page.goto('/conta/sinistros/novo')
  await chooseOption(page, 'Apólice', /Galaxy S25/)
  await chooseOption(page, 'O que aconteceu?', /^Roubo/)
  await page.getByLabel('Data e hora do ocorrido').fill(local)
  await page.getByLabel('Local').fill('Av. Paulista, 1000 – São Paulo/SP')
  await page.getByLabel('Descreva o que aconteceu').fill('Fui abordado na saída do metrô e levaram meu celular.')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByText(/Sinistro SN-\d{4}-\d{6} aberto/)).toBeVisible()
  await page.getByLabel('Selecionar documentos').setInputFiles({
    name: 'boletim.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\nBoletim de ocorrencia de teste\n'),
  })
  await page.getByRole('button', { name: /Enviar 1 arquivo/ }).click()
  await expect(page.getByRole('heading', { name: /Sinistro SN-/ })).toBeVisible()
  await expect(page.getByText('boletim.pdf')).toBeVisible()
  const claimUrl = page.url()

  // 6. Atendente analisa e aprova (outra sessão, como admin)
  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  await adminPage.goto('/entrar')
  await adminPage.getByLabel('E-mail').fill(ADMIN.email)
  await adminPage.getByLabel('Senha').fill(ADMIN.password)
  await adminPage.getByRole('button', { name: 'Entrar' }).click()
  await expect(adminPage).toHaveURL(/\/conta\/apolices/)
  await adminPage.goto(claimUrl.replace('/conta/sinistros/', '/admin/sinistros/'))
  await adminPage.getByRole('button', { name: 'Iniciar análise' }).click()
  await adminPage.getByRole('button', { name: 'Aprovar' }).click()
  await adminPage.getByLabel(/Motivo/).fill('Boletim de ocorrência válido.')
  await adminPage.getByRole('button', { name: 'Confirmar' }).click()
  await expect(adminPage.getByText('Aguardando franquia').first()).toBeVisible()
  await adminCtx.close()

  // 7. Cliente paga a franquia e o sinistro é concluído
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Pagamento da franquia' })).toBeVisible()
  await page.getByRole('button', { name: 'Pagar franquia' }).click()
  await page.getByRole('link', { name: /simular pagamento do Pix/ }).click()
  await page.getByRole('button', { name: 'Aprovar pagamento' }).click()
  await expect(page.getByText('Pagamento aprovado!')).toBeVisible()
  await page.getByRole('link', { name: 'Ver sinistro' }).click()
  await expect(page.getByText('Concluído').first()).toBeVisible()
  await expect(page.getByText(/Reposição do aparelho encaminhada/).first()).toBeVisible()
})
