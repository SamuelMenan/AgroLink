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

function fetchWithTimeout(fetchImpl: FetchLike, input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  const merged: RequestInit = { ...init, signal: controller.signal }
  return fetchImpl(input, merged).finally(() => clearTimeout(id))
}

async function warmupBackend(fetchImpl: FetchLike, proxyUrlBase: string, directUrlBase: string) {
  // Best effort: ping health endpoints to wake Render. Ignore errors.
  try {
    await fetchImpl(`${proxyUrlBase}/actuator/health`, { cache: 'no-store' })
  } catch { /* ignore */ }
  // Only attempt cross-origin warm-up if the frontend and backend share origin; otherwise it just produces CORS noise.
  if (typeof window === 'undefined' || directUrlBase.startsWith(window.location.origin)) {
    try {
      await fetchImpl(`${directUrlBase}/actuator/health`, { cache: 'no-store' })
    } catch { /* ignore */ }
  }
}

export async function apiFetch(path: string, init: RequestInit = {}, fetchImpl: FetchLike = fetch): Promise<Response> {
  if (!path.startsWith('/')) throw new Error('apiFetch expects a relative path starting with /')

  const token = getAccessToken()
  const headers = new Headers(init.headers || undefined)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const directUrl = `${BASE_URL}${path}`
  const proxiedPath = path.startsWith('/api/proxy') ? path : (path.startsWith('/') ? `/api/proxy${path}` : `/api/proxy/${path}`)
  const proxyUrl = proxiedPath

  // In PROD, when origins differ, force proxy-only to avoid CORS/gateway noise
  const prodProxyOnly = (() => {
    try {
      if (import.meta.env.PROD && typeof window !== 'undefined') {
        const base = new URL(BASE_URL)
        return base.origin !== window.location.origin
      }
    } catch {}
    return false
  })()

  const maxRetries = 5
  let lastError: unknown = null
  let lastUrlTried = directUrl

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Primary attempt: direct backend (CORS permitido)
      const primary = directUrl
      lastUrlTried = primary
      let res = await fetchWithTimeout(fetchImpl, primary, { ...init, headers }, 6000)
      // Si falla (405/5xx), intentar vía proxy same-origin dentro del mismo intento
      if (!res.ok && [502, 503, 504, 405].includes(res.status)) {
        try {
          lastUrlTried = proxyUrl
          res = await fetchWithTimeout(fetchImpl, proxyUrl, { ...init, headers }, 6000)
        } catch (e2) {
          lastError = e2
        }
      }
      if (!res.ok && [502, 503, 504].includes(res.status) && attempt < maxRetries - 1) {
        await warmupBackend(fetchImpl, '', BASE_URL)
        await sleep(300 * (attempt + 1) * 2)
        continue
      }
      return res
    } catch (e) {
      lastError = e
      if (attempt < maxRetries - 1) {
        await warmupBackend(fetchImpl, '', BASE_URL)
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
