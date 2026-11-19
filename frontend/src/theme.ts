import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: { main: '#4338ca', light: '#6366f1', dark: '#3730a3', contrastText: '#ffffff' },
    secondary: { main: '#0f766e' },
    background: { default: '#f8fafc', paper: '#ffffff' },
    text: { primary: '#111827', secondary: '#4b5563' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, Arial, sans-serif',
    h1: { fontWeight: 800, fontSize: '2.4rem', lineHeight: 1.15 },
    h2: { fontWeight: 700, fontSize: '1.9rem' },
    h3: { fontWeight: 700, fontSize: '1.5rem' },
    h4: { fontWeight: 700, fontSize: '1.3rem' },
    h5: { fontWeight: 600, fontSize: '1.1rem' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiPaper: { styleOverrides: { outlined: { borderColor: '#e5e7eb' } } },
    MuiTextField: { defaultProps: { fullWidth: true } },
    // Foco de teclado sempre visível (acessibilidade)
    MuiButtonBase: {
      styleOverrides: { root: { '&.Mui-focusVisible': { outline: '3px solid #a5b4fc', outlineOffset: 2 } } },
    },
  },
})
