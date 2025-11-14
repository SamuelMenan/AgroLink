import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAccessToken } from '../services/apiAuth'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const token = getAccessToken() // permite paso si hay tokens aunque el user aún no está listo

  if (loading) return null
  if (!user && !token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <Outlet />
}
