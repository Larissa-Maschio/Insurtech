import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import type { ApiErrorBody, User } from './types'

/**
 * Cliente HTTP único. O access token fica só em memória; o refresh token fica num cookie httpOnly
 * que o navegador envia sozinho para /api/auth. Em 401, renova o token uma vez e repete a requisição.
 */
export const api = axios.create({ baseURL: '/api', withCredentials: true })

let accessToken: string | null = null
let onSessionEnd: (() => void) | null = null

export const setAccessToken = (t: string | null) => {
  accessToken = t
}
export const setSessionEndHandler = (fn: () => void) => {
  onSessionEnd = fn
}

export interface AuthResponse {
  accessToken: string
  user: User
}

let refreshing: Promise<AuthResponse | null> | null = null

/** Renova a sessão (uma única requisição mesmo com várias chamadas simultâneas). */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= axios
    .post<AuthResponse>('/api/auth/refresh', null, { withCredentials: true })
    .then((r) => {
      setAccessToken(r.data.accessToken)
      return r.data
    })
    .catch(() => {
      setAccessToken(null)
      return null
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as AxiosRequestConfig & { _retried?: boolean }
  const isAuthRoute = original?.url?.startsWith('/auth/')
  if (error.response?.status === 401 && original && !original._retried && !isAuthRoute) {
    original._retried = true
    const session = await refreshSession()
    if (session) return api(original)
    onSessionEnd?.()
  }
  return Promise.reject(error)
})

/** Mensagem amigável para qualquer erro (a API já devolve textos em português). */
export function errorMessage(err: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.'
    const body = err.response.data as Partial<ApiErrorBody> | undefined
    if (body?.code === 'DADOS_INVALIDOS' && Array.isArray(body.details) && body.details.length) {
      return String(body.details[0])
    }
    return body?.message ?? fallback
  }
  return fallback
}

export function errorCode(err: unknown): string | undefined {
  return axios.isAxiosError(err) ? (err.response?.data as ApiErrorBody | undefined)?.code : undefined
}
