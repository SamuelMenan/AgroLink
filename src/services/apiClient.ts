import { getAccessToken } from './apiAuth'

// Generic API fetch with direct-first strategy and fallback via same-origin rewrite.
// Adds Authorization header if an access token exists.

const resolveBaseUrl = () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const envBackend = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_BACKEND_URL
  if (import.meta.env.PROD) {
    return envBackend || origin
  }
  return envBackend || 'http://localhost:8080'
}

const BASE_URL = resolveBaseUrl()

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function apiFetch(path: string, init: RequestInit = {}, fetchImpl: FetchLike = fetch): Promise<Response> {
  if (!path.startsWith('/')) throw new Error('apiFetch expects a relative path starting with /')

  const token = getAccessToken()
  const headers = new Headers(init.headers || undefined)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const primaryUrl = `${BASE_URL}${path}`
  const fallbackUrl = path // same-origin (Vercel rewrite in prod)

  const maxRetries = 3
  let lastError: unknown = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let res = await fetchImpl(primaryUrl, { ...init, headers })
      if (!res.ok && import.meta.env.PROD) {
        if ([502, 503, 504].includes(res.status)) {
          await sleep(150)
          res = await fetchImpl(fallbackUrl, { ...init, headers })
        }
      }
      if (!res.ok && [502, 503, 504].includes(res.status) && attempt < maxRetries - 1) {
        await sleep(300 * (attempt + 1))
        continue
      }
      return res
    } catch (e) {
      lastError = e
      if (attempt < maxRetries - 1) {
        await sleep(300 * (attempt + 1))
        continue
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('API request failed')
}
