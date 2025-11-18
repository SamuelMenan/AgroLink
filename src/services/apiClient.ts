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

async function warmupBackend(fetchImpl: FetchLike, proxyUrlBase: string, directUrlBase: string) {
  // Best effort: ping health endpoints to wake Render. Ignore errors.
  try {
    await fetchImpl(`${proxyUrlBase}/actuator/health`, { cache: 'no-store' })
  } catch { /* ignore */ }
  try {
    await fetchImpl(`${directUrlBase}/actuator/health`, { cache: 'no-store' })
  } catch { /* ignore */ }
}

export async function apiFetch(path: string, init: RequestInit = {}, fetchImpl: FetchLike = fetch): Promise<Response> {
  if (!path.startsWith('/')) throw new Error('apiFetch expects a relative path starting with /')

  const token = getAccessToken()
  const headers = new Headers(init.headers || undefined)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const directUrl = `${BASE_URL}${path}`
  const proxyUrl = path // same-origin (Vercel rewrite in prod)

  // Prefer proxy first in PROD when origins differ to avoid noisy CORS errors.
  let first = directUrl
  let second = proxyUrl
  try {
    const base = new URL(BASE_URL)
    if (import.meta.env.PROD && typeof window !== 'undefined') {
      if (base.origin !== window.location.origin) {
        first = proxyUrl
        second = directUrl
      }
    }
  } catch { /* ignore URL parse */ }

  const maxRetries = 5
  let lastError: unknown = null
  let lastUrlTried = first

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Try first URL
      lastUrlTried = first
      let res = await fetchImpl(first, { ...init, headers })
      // If gateway error, try second URL within same attempt
      if (!res.ok && [502, 503, 504].includes(res.status)) {
        await sleep(150)
        lastUrlTried = second
        res = await fetchImpl(second, { ...init, headers })
      }
      if (!res.ok && [502, 503, 504].includes(res.status) && attempt < maxRetries - 1) {
        await warmupBackend(fetchImpl, BASE_URL.startsWith('http') ? '' : '', BASE_URL)
        await sleep(300 * (attempt + 1) * 2)
        continue
      }
      return res
    } catch (e) {
      lastError = e
      // Network/CORS error: try the other URL once in this attempt
      try {
        lastUrlTried = second
        const res2 = await fetchImpl(second, { ...init, headers })
        if (!res2.ok && [502, 503, 504].includes(res2.status) && attempt < maxRetries - 1) {
          await warmupBackend(fetchImpl, BASE_URL.startsWith('http') ? '' : '', BASE_URL)
          await sleep(300 * (attempt + 1) * 2)
          continue
        }
        return res2
      } catch (e2) {
        lastError = e2
        lastUrlTried = second
      }
      if (attempt < maxRetries - 1) {
        await warmupBackend(fetchImpl, BASE_URL.startsWith('http') ? '' : '', BASE_URL)
        await sleep(300 * (attempt + 1) * 2)
        continue
      }
    }
  }
  const error = lastError instanceof Error ? lastError : new Error('API request failed')
  if (!(lastError instanceof Error)) {
    ;(error as { cause?: unknown }).cause = lastError
  }
  ;(error as { url?: string }).url = lastUrlTried
  console.error('[apiFetch] request failed after retries', { path, lastUrlTried, error })
  throw error
}
