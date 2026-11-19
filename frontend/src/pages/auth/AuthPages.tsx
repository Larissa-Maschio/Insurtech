import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  FormControlLabel,
  FormHelperText,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link as RouterLink, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { usePageTitle } from '../../components/feedback'
import { maskCpf, maskPhone, onlyDigits } from '../../lib/format'
import { LoginForm, loginSchema, RegisterForm, registerSchema, ResetForm, resetSchema } from '../../lib/schemas'

function AuthCard({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  usePageTitle(title)
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography variant="h3" component="h1">
            {title}
          </Typography>
          {subtitle && (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {subtitle}
            </Typography>
          )}
          <Box sx={{ mt: 3 }}>{children}</Box>
        </CardContent>
      </Card>
    </Container>
  )
}

/** Para onde voltar depois de entrar (ex.: a contratação da cotação salva). */
function useReturnTo() {
  const location = useLocation()
  return (location.state as { from?: string } | null)?.from ?? '/conta/apolices'
}

export function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const returnTo = useReturnTo()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  if (user) return <Navigate to={returnTo} replace />

  const onSubmit = handleSubmit(async (data) => {
    setError(null)
    try {
      await login(data.email, data.password)
      navigate(returnTo, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  })

  return (
    <AuthCard title="Entrar" subtitle="Acesse suas apólices, sinistros e chamados.">
      <Stack component="form" spacing={2} onSubmit={onSubmit} noValidate>
        {error && (
          <Alert severity="error" role="alert">
            {error}
          </Alert>
        )}
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          {...register('email')}
          error={!!formState.errors.email}
          helperText={formState.errors.email?.message}
        />
        <TextField
          label="Senha"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          error={!!formState.errors.password}
          helperText={formState.errors.password?.message}
        />
        <Button type="submit" variant="contained" size="large" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Link component={RouterLink} to="/esqueci-senha">
            Esqueci minha senha
          </Link>
          <Link component={RouterLink} to="/cadastro" state={{ from: returnTo }}>
            Criar conta
          </Link>
        </Box>
      </Stack>
    </AuthCard>
  )
}

export function RegisterPage() {
  const { register: signUp, user } = useAuth()
  const navigate = useNavigate()
  const returnTo = useReturnTo()
  const [error, setError] = useState<string | null>(null)
  const { register, control, handleSubmit, formState } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', cpf: '', phone: '', password: '', confirmPassword: '', acceptTerms: false },
  })

  if (user) return <Navigate to={returnTo} replace />

  const onSubmit = handleSubmit(async (data) => {
    setError(null)
    try {
      await signUp({
        name: data.name,
        email: data.email,
        cpf: onlyDigits(data.cpf),
        phone: onlyDigits(data.phone),
        password: data.password,
        acceptTerms: data.acceptTerms,
      })
      navigate(returnTo, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  })

  const e = formState.errors
  return (
    <AuthCard title="Criar conta" subtitle="Leva menos de um minuto.">
      <Stack component="form" spacing={2} onSubmit={onSubmit} noValidate>
        {error && (
          <Alert severity="error" role="alert">
            {error}
          </Alert>
        )}
        <TextField
          label="Nome completo"
          autoComplete="name"
          {...register('name')}
          error={!!e.name}
          helperText={e.name?.message}
        />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          {...register('email')}
          error={!!e.email}
          helperText={e.email?.message}
        />
        <Controller
          name="cpf"
          control={control}
          render={({ field }) => (
            <TextField
              label="CPF"
              {...field}
              value={field.value}
              onChange={(ev) => field.onChange(maskCpf(ev.target.value))}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
              error={!!e.cpf}
              helperText={e.cpf?.message}
            />
          )}
        />
        <Controller
          name="phone"
          control={control}
          render={({ field }) => (
            <TextField
              label="Celular"
              autoComplete="tel"
              {...field}
              onChange={(ev) => field.onChange(maskPhone(ev.target.value))}
              slotProps={{ htmlInput: { inputMode: 'tel' } }}
              error={!!e.phone}
              helperText={e.phone?.message}
            />
          )}
        />
        <TextField
          label="Senha"
          type="password"
          autoComplete="new-password"
          {...register('password')}
          error={!!e.password}
          helperText={e.password?.message ?? 'Mínimo de 8 caracteres, com letras e números.'}
        />
        <TextField
          label="Confirme a senha"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          error={!!e.confirmPassword}
          helperText={e.confirmPassword?.message}
        />
        <Box>
          <Controller
            name="acceptTerms"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox checked={field.value} onChange={(ev) => field.onChange(ev.target.checked)} />}
                label={
                  <>
                    Li e aceito os{' '}
                    <Link component={RouterLink} to="/termos" target="_blank">
                      termos de uso
                    </Link>{' '}
                    e a{' '}
                    <Link component={RouterLink} to="/privacidade" target="_blank">
                      política de privacidade
                    </Link>
                    .
                  </>
                }
              />
            )}
          />
          {e.acceptTerms && <FormHelperText error>{e.acceptTerms.message}</FormHelperText>}
        </Box>
        <Button type="submit" variant="contained" size="large" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Criando conta…' : 'Criar conta'}
        </Button>
        <Typography>
          Já tem conta?{' '}
          <Link component={RouterLink} to="/entrar" state={{ from: returnTo }}>
            Entrar
          </Link>
        </Typography>
      </Stack>
    </AuthCard>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const mutation = useMutation({ mutationFn: () => api.post('/auth/forgot-password', { email }) })
  return (
    <AuthCard title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha.">
      {mutation.isSuccess ? (
        <Alert severity="success">
          Se houver uma conta com este e-mail, você receberá o link em instantes. O link vale por 1 hora.
        </Alert>
      ) : (
        <Stack
          component="form"
          spacing={2}
          onSubmit={(ev) => {
            ev.preventDefault()
            mutation.mutate()
          }}
        >
          {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
          <TextField
            label="E-mail"
            type="email"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            autoComplete="email"
          />
          <Button type="submit" variant="contained" disabled={mutation.isPending || !email}>
            Enviar link
          </Button>
        </Stack>
      )}
      <Box sx={{ mt: 2 }}>
        <Link component={RouterLink} to="/entrar">
          Voltar para o login
        </Link>
      </Box>
    </AuthCard>
  )
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { register, handleSubmit, formState } = useForm<ResetForm>({ resolver: zodResolver(resetSchema) })
  const mutation = useMutation({
    mutationFn: (password: string) => api.post('/auth/reset-password', { token, password }),
  })

  return (
    <AuthCard title="Nova senha">
      {mutation.isSuccess ? (
        <Alert
          severity="success"
          action={
            <Button component={RouterLink} to="/entrar" color="inherit">
              Entrar
            </Button>
          }
        >
          Senha alterada com sucesso.
        </Alert>
      ) : (
        <Stack component="form" spacing={2} onSubmit={handleSubmit((d) => mutation.mutate(d.password))} noValidate>
          {!token && <Alert severity="warning">Link incompleto. Abra o link exatamente como recebido no e-mail.</Alert>}
          {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
          <TextField
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            {...register('password')}
            error={!!formState.errors.password}
            helperText={formState.errors.password?.message}
          />
          <TextField
            label="Confirme a nova senha"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword')}
            error={!!formState.errors.confirmPassword}
            helperText={formState.errors.confirmPassword?.message}
          />
          <Button type="submit" variant="contained" disabled={mutation.isPending || !token}>
            Salvar nova senha
          </Button>
        </Stack>
      )}
    </AuthCard>
  )
}
