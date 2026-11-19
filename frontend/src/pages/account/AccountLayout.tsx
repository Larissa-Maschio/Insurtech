import { Box, Container, Tab, Tabs, Typography } from '@mui/material'
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

const TABS = [
  { to: '/conta/apolices', label: 'Minhas apólices' },
  { to: '/conta/sinistros', label: 'Sinistros' },
  { to: '/conta/suporte', label: 'Suporte' },
  { to: '/conta/avaliar', label: 'Avaliar' },
]

export function AccountLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const current = TABS.findIndex((t) => pathname.startsWith(t.to))
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography color="text.secondary">Olá, {user?.name.split(' ')[0]}</Typography>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={current === -1 ? false : current}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label="Área do cliente"
        >
          {TABS.map((t) => (
            <Tab key={t.to} label={t.label} component={RouterLink} to={t.to} />
          ))}
        </Tabs>
      </Box>
      <Outlet />
    </Container>
  )
}
