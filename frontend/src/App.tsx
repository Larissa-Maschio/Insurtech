import { Container } from '@mui/material'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAdmin, RequireAuth } from './auth/guards'
import { Layout } from './components/Layout'
import { AccountLayout } from './pages/account/AccountLayout'
import { ClaimDetailPage, ClaimsPage, NewClaimPage } from './pages/account/ClaimsPages'
import { PoliciesPage, PolicyDetailPage } from './pages/account/PoliciesPages'
import { FeedbackPage, NewTicketPage, TicketDetailPage, TicketsPage } from './pages/account/SupportPages'
import {
  AdminClaimDetailPage,
  AdminClaimsPage,
  AdminDevToolsPage,
  AdminFeedbacksPage,
  AdminLayout,
} from './pages/admin/AdminPages'
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/auth/AuthPages'
import { CheckoutPage } from './pages/checkout/CheckoutPage'
import { MockCheckoutPage, PaymentPage } from './pages/checkout/PaymentPage'
import { LandingPage } from './pages/LandingPage'
import { QuotePage } from './pages/QuotePage'
import { QuoteResultPage } from './pages/QuoteResultPage'
import { NotFoundPage, PrivacyPage, TermsPage } from './pages/StaticPages'

const guard = (el: JSX.Element) => <RequireAuth>{el}</RequireAuth>

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="cotacao" element={<QuotePage />} />
        <Route path="cotacao/:id" element={<QuoteResultPage />} />
        <Route path="entrar" element={<LoginPage />} />
        <Route path="cadastro" element={<RegisterPage />} />
        <Route path="esqueci-senha" element={<ForgotPasswordPage />} />
        <Route path="redefinir-senha" element={<ResetPasswordPage />} />
        <Route path="termos" element={<TermsPage />} />
        <Route path="privacidade" element={<PrivacyPage />} />

        <Route path="contratar/:quoteId/:plan" element={guard(<CheckoutPage />)} />
        <Route path="pagamento/:id" element={guard(<PaymentPage />)} />
        <Route path="pagamento/:id/checkout-simulado" element={guard(<MockCheckoutPage />)} />

        <Route path="conta" element={guard(<AccountLayout />)}>
          <Route index element={<Navigate to="apolices" replace />} />
          <Route path="apolices" element={<PoliciesPage />} />
          <Route path="apolices/:id" element={<PolicyDetailPage />} />
          <Route path="sinistros" element={<ClaimsPage />} />
          <Route path="sinistros/novo" element={<NewClaimPage />} />
          <Route path="sinistros/:id" element={<ClaimDetailPage />} />
          <Route path="suporte" element={<TicketsPage />} />
          <Route path="suporte/novo" element={<NewTicketPage />} />
          <Route path="suporte/:id" element={<TicketDetailPage />} />
          <Route path="avaliar" element={<FeedbackPage />} />
        </Route>

        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Navigate to="sinistros" replace />} />
          <Route path="sinistros" element={<AdminClaimsPage />} />
          <Route path="sinistros/:id" element={<AdminClaimDetailPage />} />
          <Route path="chamados" element={<TicketsPage admin />} />
          <Route
            path="chamados/:id"
            element={
              <Container disableGutters>
                <TicketDetailPage />
              </Container>
            }
          />
          <Route path="avaliacoes" element={<AdminFeedbacksPage />} />
          <Route path="ferramentas" element={<AdminDevToolsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
