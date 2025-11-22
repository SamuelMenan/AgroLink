import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setTokens, type BackendAuthResponse } from '../services/apiAuth'

export default function OAuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // URL ejemplo:
    // https://agro-link-jet.vercel.app/oauth/callback?next=https://agro-link-jet.vercel.app/simple#access_token=...&refresh_token=...
    const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const hashParams = new URLSearchParams(rawHash)
    const access_token = hashParams.get('access_token')
    const refresh_token = hashParams.get('refresh_token') || ''
    const token_type = hashParams.get('token_type') || undefined
    const expires_in = hashParams.get('expires_in') ? Number(hashParams.get('expires_in')) : undefined

    const storedAccess = localStorage.getItem('agrolink_access_token')
    const hasIncomingTokens = !!access_token
    const effectiveAccess = hasIncomingTokens ? access_token : storedAccess

    if (!effectiveAccess) {
      console.debug('[OAuthCallback] No tokens in hash or storage -> redirect login')
      navigate('/login', { replace: true })
      return
    }

    if (hasIncomingTokens) {
      const backendResp: BackendAuthResponse = { access_token: effectiveAccess, refresh_token, token_type, expires_in, user: undefined }
      try {
        setTokens(backendResp)
        console.info('[OAuthCallback] Tokens OAuth guardados correctamente (hash)')
      } catch (e) {
        console.error('[OAuthCallback] Error guardando tokens OAuth', e)
      }
      // Limpiar hash para no dejar tokens en la barra
      try { window.history.replaceState(null, '', window.location.pathname + window.location.search) } catch { /* ignore */ }
    } else {
      console.debug('[OAuthCallback] Usando tokens ya almacenados, hash vacío (idempotente)')
    }

    // Leer ?next=... de la query
    const searchParams = new URLSearchParams(window.location.search)
    const rawNext = searchParams.get('next') || '/'

    let nextPath = '/'

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
        nextPath = '/'
      } else if (url.pathname === '/oauth/callback') {
        // Evita bucles: nunca navegues de nuevo al callback
        nextPath = '/'
      } else {
        nextPath = url.pathname + url.search + url.hash
      }
    } catch {
      // Si rawNext no es una URL válida, permitir solo rutas absolutas internas
      nextPath = rawNext.startsWith('/') ? rawNext : '/'
    }

    // Logs de depuración y limpieza de URL
    console.debug('[OAuthCallback] rawNext =', rawNext)
    console.debug('[OAuthCallback] nextPath =', nextPath)
    console.debug('[OAuthCallback] final redirect decision', {
      hasIncomingTokens,
      storedAccessPresent: !!storedAccess,
      pathname: window.location.pathname
    })
    try {
      window.history.replaceState(null, '', window.location.pathname)
    } catch { /* ignore */ }

    // Redirección forzada para eliminar la URL larga del historial
    try {
      if (nextPath && nextPath !== window.location.pathname) {
        console.debug('[OAuthCallback] location.replace ->', nextPath)
        window.location.replace(nextPath)
        return
      }
    } catch (e) {
      console.warn('[OAuthCallback] location.replace falló, fallback navigate()', e)
    }

    navigate(nextPath || '/', { replace: true })

    // Fallback adicional por si nada anterior efectúa la navegación (errores silenciosos de runtime o carga tardía):
    setTimeout(() => {
      if (window.location.pathname === '/oauth/callback') {
        console.warn('[OAuthCallback] Fallback timeout firing, aún en /oauth/callback -> forzando redirect a', nextPath)
        try {
          window.location.replace(nextPath || '/')
        } catch (err) {
          console.error('[OAuthCallback] Fallback replace también falló, intentando assign', err)
          try { window.location.assign(nextPath || '/') } catch { /* ignore */ }
        }
      }
    }, 800)
  }, [navigate])

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-gray-700">Procesando inicio de sesión...</p>
    </main>
  )
}
