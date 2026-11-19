import { ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { theme } from '../theme'

/** Renderiza uma página com router, React Query, tema e autenticação. */
export function renderPage(ui: ReactElement, { route = '/', path = '*' }: { route?: string; path?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>
            <Routes>
              <Route path={path} element={ui} />
              <Route path="/cotacao/:id" element={<div>Resultado da cotação</div>} />
              <Route path="/conta/apolices" element={<div>Área do cliente</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}
