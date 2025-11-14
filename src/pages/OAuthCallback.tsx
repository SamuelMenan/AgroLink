import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { setTokens, type AuthTokens } from '../services/apiAuth'
import { useAuth } from '../context/AuthContext'

// Parse hash fragment returned by Supabase OAuth (#access_token=...&refresh_token=...)
function parseFragmentOrQuery(): Partial<AuthTokens> {
  const out: Record<string, string> = {}
  const hash = window.location.hash.replace(/^#/, '')
  const collect = (segment: string) => {
    if (!segment) return
    segment.split('&').forEach(kv => {
      const [k, v] = kv.split('=')
      if (k && v) out[decodeURIComponent(k)] = decodeURIComponent(v)
    })
  }
  collect(hash)
  // Some providers / configurations may return tokens in query parameters (less ideal, but handle it)
  const qs = window.location.search.replace(/^\?/, '')
  collect(qs)
  return {
    access_token: out['access_token'],
    refresh_token: out['refresh_token'],
    expires_in: out['expires_in'] ? Number(out['expires_in']) : undefined,
    token_type: out['token_type']
  }
}

function normalizeNext(rawNext: string | null): string {
  const fallback = '/simple'
  if (!rawNext || rawNext.trim() === '') return fallback
  let next = rawNext
  try {
    if (rawNext.startsWith('http')) {
      const url = new URL(rawNext)
      next = url.pathname + url.search + url.hash
    }
  } catch {
    // si falla el parseo, usamos rawNext tal cual
  }
  return next || fallback
}

export default function OAuthCallback() {
  const navigate = useNavigate()
  const { user } = useAuth(); void user
  const ran = useRef(false)

  useEffect(() => {
    const run = async () => {
      if (ran.current) return; ran.current = true
      console.log('OAuthCallback: URL', window.location.href)
      const tokens = parseFragmentOrQuery()
      console.log('OAuthCallback: tokens', tokens)
      const params = new URLSearchParams(window.location.search)

      // 1) Caso flujo implícito: tokens en el fragmento/query
      if (tokens.access_token && tokens.refresh_token) {
        try {
          setTokens(tokens as AuthTokens)
          const rawNext = params.get('next')
          const next = normalizeNext(rawNext)
          window.location.replace(next)
        } catch (e) {
          console.error('Error procesando tokens OAuth', e)
          navigate('/login?error=oauth_store', { replace: true })
        }
        return
      }

      // 2) Caso flow con code: no hay tokens pero sí code => intercambiar en backend
      const code = params.get('code')
      if (!code) {
        navigate('/login?error=oauth_missing', { replace: true })
        return
      }

      try {
        const redirectUri = `${window.location.origin}/oauth/callback`
        const res = await fetch('/api/v1/auth/oauth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirectUri })
        })

        if (!res.ok) {
          const text = await res.text()
          console.error('Fallo intercambio código OAuth', res.status, text)
          navigate('/login?error=oauth_exchange_failed', { replace: true })
          return
        }

        const data = await res.json() as AuthTokens
        if (!data.access_token || !data.refresh_token) {
          console.error('Respuesta de intercambio sin tokens', data)
          navigate('/login?error=oauth_exchange_missing_tokens', { replace: true })
          return
        }

        setTokens(data)
        const rawNext = params.get('next')
        const next = normalizeNext(rawNext)
        window.location.replace(next)
      } catch (e) {
        console.error('Excepción en intercambio de código OAuth', e)
        navigate('/login?error=oauth_exchange_exception', { replace: true })
      }
    }

    void run()
  }, [navigate])

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow max-w-md text-sm">
        <p className="text-gray-600">Procesando autenticación…</p>
      </div>
    </main>
  )
}
