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
      // Supabase implicit flow NO suele incluir "user" en este hash;
      // lo dejamos undefined y más adelante podrás recuperarlo vía backend si lo necesitas.
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
      const url = new URL(
        rawNext,
        rawNext.startsWith('http') ? undefined : window.location.origin,
      )

      // Si la URL es de otro origin, ignórala por seguridad
      if (url.origin !== window.location.origin) {
        nextPath = '/simple'
      } else if (url.pathname === '/oauth/callback') {
        // Evita bucles: nunca navegues de nuevo al callback
        nextPath = '/simple'
      } else {
        nextPath = url.pathname + url.search + url.hash
      }
    } catch {
      // Si rawNext es algo como "/simple" o "simple"
      if (rawNext.startsWith('/')) {
        nextPath = rawNext
      } else {
        nextPath = '/simple'
      }
    }

    navigate(nextPath || '/simple', { replace: true })
  }, [navigate])

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-gray-700">Procesando inicio de sesión...</p>
    </main>
  )
}
