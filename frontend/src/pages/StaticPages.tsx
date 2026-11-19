import { Button, Container, Typography } from '@mui/material'
import { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { usePageTitle } from '../components/feedback'

function Doc({ title, children }: { title: string; children: ReactNode }) {
  usePageTitle(title)
  return (
    <Container maxWidth="md" sx={{ py: 6, '& h2': { mt: 4, mb: 1 }, '& p': { mb: 1.5 } }}>
      <Typography variant="h2" component="h1">
        {title}
      </Typography>
      {children}
    </Container>
  )
}

export function TermsPage() {
  return (
    <Doc title="Termos de uso e condições gerais">
      <Typography color="text.secondary">Projeto acadêmico: este documento é um modelo simplificado.</Typography>
      <Typography variant="h4" component="h2">
        1. Objeto
      </Typography>
      <Typography>
        O seguro cobre o aparelho identificado pelo IMEI na apólice, conforme as coberturas do plano contratado.
      </Typography>
      <Typography variant="h4" component="h2">
        2. Vigência e pagamento
      </Typography>
      <Typography>
        A apólice começa na confirmação do pagamento e se renova mensalmente. Com atraso, a cobertura é suspensa no 10º
        dia e a apólice é cancelada no 30º dia.
      </Typography>
      <Typography variant="h4" component="h2">
        3. Carência
      </Typography>
      <Typography>
        7 dias para roubo e furto qualificado; 30 dias para as demais coberturas, contados do início da primeira
        vigência.
      </Typography>
      <Typography variant="h4" component="h2">
        4. Franquia
      </Typography>
      <Typography>
        Percentual do valor de referência do aparelho, por cobertura, pago após a aprovação do sinistro e antes da
        reposição ou do reparo.
      </Typography>
      <Typography variant="h4" component="h2">
        5. Sinistro
      </Typography>
      <Typography>
        Deve ser comunicado em até 30 dias, com os documentos exigidos. Limite de 2 sinistros a cada 12 meses. Roubo ou
        furto indenizado encerra a apólice.
      </Typography>
      <Typography variant="h4" component="h2">
        6. Cancelamento
      </Typography>
      <Typography>
        Pode ser feito a qualquer momento pela área do cliente; a cobertura segue até o fim do período pago, sem
        reembolso proporcional.
      </Typography>
    </Doc>
  )
}

export function PrivacyPage() {
  return (
    <Doc title="Política de privacidade">
      <Typography>Tratamos seus dados conforme a Lei Geral de Proteção de Dados (LGPD).</Typography>
      <Typography variant="h4" component="h2">
        Dados coletados
      </Typography>
      <Typography>
        Nome, e-mail, CPF, telefone, IMEI e dados do aparelho, e os documentos enviados em sinistros. Coletamos apenas o
        necessário para cotar, contratar e atender o seguro.
      </Typography>
      <Typography variant="h4" component="h2">
        Pagamentos
      </Typography>
      <Typography>
        Os dados do cartão são digitados no ambiente do gateway de pagamento e nunca passam pelos nossos servidores.
      </Typography>
      <Typography variant="h4" component="h2">
        Segurança
      </Typography>
      <Typography>
        Senhas são guardadas com hash (argon2). Documentos de sinistro ficam fora de área pública e só são acessados por
        você e pelo atendimento.
      </Typography>
      <Typography variant="h4" component="h2">
        Seus direitos
      </Typography>
      <Typography>
        Você pode pedir acesso, correção ou exclusão dos seus dados abrindo um chamado no suporte.
      </Typography>
    </Doc>
  )
}

export function NotFoundPage() {
  usePageTitle('Página não encontrada')
  return (
    <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
      <Typography variant="h2" component="h1">
        Página não encontrada
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 2 }}>
        O endereço pode ter mudado ou não existe.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained" sx={{ mt: 3 }}>
        Ir para o início
      </Button>
    </Container>
  )
}
