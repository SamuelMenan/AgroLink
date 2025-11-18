import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setTokens, deriveUserFromTokens, type BackendAuthResponse } from '../services/apiAuth'

export default function OAuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // Ejemplo de URL:
    // https://agro-link-jet.vercel.app/oauth/callback?next=/simple#access_token=...&refresh_token=...&expires_in=...
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash
    const hashParams = new URLSearchParams(hash)

    const access_token = hashParams.get('access_token')
    const refresh_token = hashParams.get('refresh_token') || ''
    const token_type = hashParams.get('token_type') || undefined
    const expires_in = hashParams.get('expires_in')
      ? Number(hashParams.get('expires_in'))
      : undefined

    if (!access_token) {
      // Si no hay token, volvemos al login
      navigate('/login', { replace: true })
      return
    }

    const backendResp: BackendAuthResponse = {
      access_token,
      refresh_token,
      token_type,
      expires_in,
    }

    try {
      // Guardar tokens en localStorage
      setTokens(backendResp)
      const user = deriveUserFromTokens(backendResp)
      console.info('[OAuthCallback] Usuario autenticado via OAuth:', user)
    } catch (e) {
      console.error('[OAuthCallback] Error procesando tokens OAuth', e)
    }

    // Leer next de query (?next=/simple o ?next=https://.../simple)
    const searchParams = new URLSearchParams(window.location.search)
    const rawNext = searchParams.get('next') || '/simple'

    // Normalizar next a ruta dentro del mismo origin
    let nextPath = '/simple'
    try {
      const url = new URL(rawNext, window.location.origin)
      nextPath = url.pathname + url.search + url.hash
    } catch {
      nextPath = rawNext.startsWith('/') ? rawNext : '/simple'
    }

    navigate(nextPath || '/simple', { replace: true })
  }, [navigate])

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-gray-700">Procesando inicio de sesión...</p>
    </main>
  )
}
