import { useQueryClient } from '@tanstack/react-query'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, AuthResponse, refreshSession, setAccessToken, setSessionEndHandler } from '../api/client'
import type { User } from '../api/types'

export interface RegisterInput {
  name: string
  email: string
  cpf: string
  phone: string
  password: string
  acceptTerms: boolean
}

interface AuthState {
  user: User | null
  /** true enquanto tenta restaurar a sessão ao abrir o site */
  loading: boolean
  login(email: string, password: string): Promise<User>
  register(input: RegisterInput): Promise<User>
  logout(): Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    setSessionEndHandler(() => setUser(null))
    refreshSession()
      .then((s) => setUser(s?.user ?? null))
      .finally(() => setLoading(false))
  }, [])

  const start = useCallback((data: AuthResponse) => {
    setAccessToken(data.accessToken)
    setUser(data.user)
    return data.user
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (email, password) => start((await api.post<AuthResponse>('/auth/login', { email, password })).data),
      register: async (input) => start((await api.post<AuthResponse>('/auth/register', input)).data),
      logout: async () => {
        await api.post('/auth/logout').catch(() => undefined)
        setAccessToken(null)
        setUser(null)
        queryClient.clear()
      },
    }),
    [user, loading, start, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
