import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setTokens, type BackendAuthResponse } from '../services/apiAuth'

export default function OAuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // URL ejemplo:
    // https://agro-link-jet.vercel.app/oauth/callback?next=https://agro-link-jet.vercel.app/simple#access_token=...&refresh_token=...
    const rawHash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash

    const hashParams = new URLSearchParams(rawHash)
    const access_token = hashParams.get('access_token')
    const refresh_token = hashParams.get('refresh_token') || ''
    const token_type = hashParams.get('token_type') || undefined
    const expires_in = hashParams.get('expires_in')
      ? Number(hashParams.get('expires_in'))
      : undefined

    if (!access_token) {
      navigate('/login', { replace: true })
      return
    }

    const backendResp: BackendAuthResponse = {
      access_token,
      refresh_token,
      token_type,
      expires_in,
      user: undefined,
    }

    try {
      setTokens(backendResp)
      console.info('[OAuthCallback] Tokens OAuth guardados correctamente')
    } catch (e) {
      console.error('[OAuthCallback] Error guardando tokens OAuth', e)
    }

    // Leer ?next=... de la query
    const searchParams = new URLSearchParams(window.location.search)
    const rawNext = searchParams.get('next') || '/simple'

    let nextPath = '/simple'

    try {
      // Permitir tanto rutas relativas como URLs absolutas de TU mismo origin
      // Siempre proveemos base; si rawNext es absoluta, la base se ignora
      const url = new URL(rawNext, window.location.origin)

      if (url.origin !== window.location.origin) {
        // Caso especial DEV: si estamos en Vercel y el next apunta a localhost,
        // redirigimos explícitamente a localhost para facilitar pruebas locales.
        const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\\d+)?$/i.test(url.origin)
        if (isLocalhost) {
          try {
            // Limpia URL actual antes de saltar de dominio
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
          } catch { /* ignore */ }
          window.location.replace(url.toString())
          return
        }
        // Orígenes externos distintos a localhost: ignorar por seguridad
        nextPath = '/simple'
      } else if (url.pathname === '/oauth/callback') {
        // Evita bucles: nunca navegues de nuevo al callback
        nextPath = '/simple'
      } else {
        nextPath = url.pathname + url.search + url.hash
      }
    } catch {
      // Si rawNext no es una URL válida, permitir solo rutas absolutas internas
      nextPath = rawNext.startsWith('/') ? rawNext : '/simple'
    }

    // Limpia completamente hash y query del callback antes de navegar
    try {
      window.history.replaceState(null, '', window.location.pathname)
    } catch {
      // ignore
    }

    navigate(nextPath || '/simple', { replace: true })
  }, [navigate])

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-gray-700">Procesando inicio de sesión...</p>
    </main>
  )
}
