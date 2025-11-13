import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setTokens, type AuthTokens } from '../services/apiAuth'
import { useAuth } from '../context/AuthContext'

// Parse hash fragment returned by Supabase OAuth (#access_token=...&refresh_token=...)
function parseHash(hash: string): Partial<AuthTokens> {
  const out: Record<string,string> = {}
  hash.replace(/^#/, '').split('&').forEach(kv => {
    const [k,v] = kv.split('=')
    if (k && v) out[decodeURIComponent(k)] = decodeURIComponent(v)
  })
  return {
    access_token: out['access_token'],
    refresh_token: out['refresh_token'],
    expires_in: out['expires_in'] ? Number(out['expires_in']) : undefined,
    token_type: out['token_type']
  }
}

export default function OAuthCallback() {
  const navigate = useNavigate()
  // Access context to trigger rerender after tokens stored
  const { user } = useAuth(); void user;
  useEffect(() => {
    const frag = window.location.hash
    if (!frag) {
      navigate('/login?error=oauth_missing', { replace: true })
      return
    }
    const tokens = parseHash(frag)
    if (!tokens.access_token || !tokens.refresh_token) {
      navigate('/login?error=oauth_tokens', { replace: true })
      return
    }
    try {
      setTokens(tokens as AuthTokens)
      // Opcional: derivar usuario inmediatamente si estructura permite
      // navigate to simple hub or provided next param
      const params = new URLSearchParams(window.location.search)
      const next = params.get('next') || '/simple'
      navigate(next, { replace: true })
    } catch (e) {
      console.error('Error procesando tokens OAuth', e)
      navigate('/login?error=oauth_store', { replace: true })
    }
  }, [navigate])
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow">
        <p className="text-sm text-gray-600">Procesando autenticación…</p>
      </div>
    </main>
  )
}
