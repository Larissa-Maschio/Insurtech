import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import ShieldIcon from '@mui/icons-material/Shield'
import { useState } from 'react'
import { Link as RouterLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { HealthBadge } from './HealthBadge'

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const links = user
    ? [
        ...(user.role === 'ADMIN' ? [{ to: '/admin/sinistros', label: 'Atendimento' }] : []),
        { to: '/conta/apolices', label: 'Minha conta' },
      ]
    : [
        { to: '/#planos', label: 'Planos' },
        { to: '/#duvidas', label: 'Dúvidas' },
        { to: '/entrar', label: 'Entrar' },
      ]

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: 1 }}>
            <Box
              component={RouterLink}
              to="/"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: 'primary.main',
                textDecoration: 'none',
                flexGrow: 1,
              }}
            >
              <ShieldIcon aria-hidden />
              <Typography variant="h6" component="span" sx={{ fontWeight: 800 }}>
                Seguradora de Celular
              </Typography>
            </Box>
            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, alignItems: 'center' }}>
              {links.map((l) => (
                <Button key={l.to} component={RouterLink} to={l.to} color="inherit">
                  {l.label}
                </Button>
              ))}
              {user ? (
                <Button onClick={handleLogout} color="inherit">
                  Sair
                </Button>
              ) : (
                <Button component={RouterLink} to="/cotacao" variant="contained">
                  Faça sua cotação
                </Button>
              )}
            </Box>
            <IconButton sx={{ display: { md: 'none' } }} onClick={() => setOpen(true)} aria-label="Abrir menu">
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <List sx={{ width: 260 }} onClick={() => setOpen(false)}>
          <ListItemButton component={RouterLink} to="/cotacao">
            <ListItemText primary="Faça sua cotação" />
          </ListItemButton>
          {links.map((l) => (
            <ListItemButton key={l.to} component={RouterLink} to={l.to}>
              <ListItemText primary={l.label} />
            </ListItemButton>
          ))}
          {user && (
            <ListItemButton onClick={handleLogout}>
              <ListItemText primary="Sair" />
            </ListItemButton>
          )}
        </List>
      </Drawer>

      <Box component="main" id="conteudo" tabIndex={-1} sx={{ flexGrow: 1, outline: 'none' }}>
        <Outlet />
      </Box>

      <Box component="footer" sx={{ bgcolor: '#111827', color: '#e5e7eb', mt: 8, py: 5 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontWeight: 700 }}>Seguradora de Celular</Typography>
              <Typography variant="body2" sx={{ color: '#9ca3af', maxWidth: 360 }}>
                Projeto acadêmico. Pagamentos em ambiente de testes: nenhuma cobrança real é feita.
              </Typography>
            </Box>
            <Box component="nav" aria-label="Rodapé" sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Link component={RouterLink} to="/termos" color="inherit">
                Termos de uso
              </Link>
              <Link component={RouterLink} to="/privacidade" color="inherit">
                Privacidade
              </Link>
              <Link component={RouterLink} to="/conta/suporte/novo" color="inherit">
                Contato
              </Link>
              <Link href="/api/docs" color="inherit">
                API
              </Link>
            </Box>
          </Box>
          <Divider sx={{ my: 3, borderColor: '#374151' }} />
          <Box
            sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Typography variant="body2" sx={{ color: '#9ca3af' }}>
              © {new Date().getFullYear()} Seguradora de Celular
            </Typography>
            <HealthBadge />
          </Box>
        </Container>
      </Box>
    </Box>
  )
}
