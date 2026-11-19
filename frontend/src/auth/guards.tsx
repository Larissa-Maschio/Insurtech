import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Loading } from '../components/feedback'
import { useAuth } from './AuthContext'

/** Exige login; guarda a página de origem para voltar depois de entrar. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  if (user.role !== 'ADMIN') return <Navigate to="/conta/apolices" replace />
  return <>{children}</>
}
