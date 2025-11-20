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

// Circuit breaker state
let circuitBreakerState: 'closed' | 'open' | 'half-open' = 'closed'
let circuitBreakerFailures = 0
let circuitBreakerLastFailure = 0
const CIRCUIT_BREAKER_THRESHOLD = 10 // Number of failures before opening
const CIRCUIT_BREAKER_TIMEOUT = 30000 // 30 seconds before trying again

// Enhanced exponential backoff with jitter to prevent thundering herd
function calculateBackoff(attempt: number, baseMs: number = 500): number {
  const jitter = Math.random() * 200 // 0-200ms jitter
  const exponential = Math.pow(2, attempt) * baseMs
  return Math.min(exponential + jitter, 5000) // Cap at 5 seconds
}

function shouldAllowRequest(): boolean {
  const now = Date.now()
  
  if (circuitBreakerState === 'closed') return true
  
  if (circuitBreakerState === 'open') {
    if (now - circuitBreakerLastFailure > CIRCUIT_BREAKER_TIMEOUT) {
      circuitBreakerState = 'half-open'
      return true
    }
    return false
  }
  
  // half-open state
  return true
}

function recordSuccess() {
  circuitBreakerState = 'closed'
  circuitBreakerFailures = 0
}

function recordFailure() {
  circuitBreakerFailures++
  circuitBreakerLastFailure = Date.now()
  
  if (circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreakerState = 'open'
    console.error('[CircuitBreaker] Circuit opened due to excessive failures')
  }
}

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
  try {
    await fetchImpl(`/api/warm`, { cache: 'no-store' })
  } catch { /* ignore */ }
  // Only attempt cross-origin warm-up if the frontend and backend share origin; otherwise it just produces CORS noise.
  if (typeof window === 'undefined' || directUrlBase.startsWith(window.location.origin)) {
    try {
      await fetchImpl(`${directUrlBase}/actuator/health`, { cache: 'no-store' })
    } catch { /* ignore */ }
  }
}

// Direct fallback fetch that bypasses the proxy
async function directFetch(path: string, init: RequestInit, headers: Headers, fetchImpl: FetchLike): Promise<Response> {
  const directUrl = `${BASE_URL}${path}`
  try {
    console.warn('[apiFetch] Attempting direct fetch to backend:', directUrl)
    const res = await fetchWithTimeout(fetchImpl, directUrl, { ...init, headers }, 15000)
    
    if (res.ok) {
      console.log('[apiFetch] Direct fetch successful')
      recordSuccess()
    } else {
      console.warn(`[apiFetch] Direct fetch failed with status: ${res.status}`)
      recordFailure()
    }
    
    return res
  } catch (e) {
    console.error('[apiFetch] Direct fetch network error:', e)
    recordFailure()
    throw e
  }
}

export async function apiFetch(path: string, init: RequestInit = {}, fetchImpl: FetchLike = fetch): Promise<Response> {
  if (!path.startsWith('/')) throw new Error('apiFetch expects a relative path starting with /')

  // Check circuit breaker before making request
  if (!shouldAllowRequest()) {
    throw new Error('Service temporarily unavailable - too many failed requests')
  }

  const token = getAccessToken()
  const headers = new Headers(init.headers || undefined)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const directUrl = `${BASE_URL}${path}`
  const proxiedPath = path.startsWith('/api/proxy') ? path : (path.startsWith('/') ? `/api/proxy${path}` : `/api/proxy/${path}`)
  const proxyUrl = proxiedPath

  // Enhanced logging for production debugging
  console.log('[apiFetch] Starting request:', {
    path,
    baseUrl: BASE_URL,
    proxyUrl,
    directUrl,
    circuitBreakerState,
    circuitBreakerFailures,
    timestamp: new Date().toISOString()
  })

  // In PROD, when origins differ, force proxy-only to avoid CORS/gateway noise

  const maxRetries = 4
  let lastError: unknown = null
  let lastUrlTried = directUrl
  let circuitBreakerTripped = false

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Primary attempt: proxy same-origin
      const primary = proxyUrl
      lastUrlTried = primary
      console.log(`[apiFetch] Attempt ${attempt + 1}/${maxRetries} via proxy:`, primary)
      let res = await fetchWithTimeout(fetchImpl, primary, { ...init, headers }, 12000)
      
      // If proxy fails with 502/503/504, immediately try direct fetch
      if (!res.ok && [502, 503, 504].includes(res.status)) {
        console.warn(`[apiFetch] Proxy failed with ${res.status}, attempting direct fetch`, {
          path,
          status: res.status,
          statusText: res.statusText,
          attempt: attempt + 1,
          timestamp: new Date().toISOString()
        })
        try {
          const directRes = await directFetch(path, init, headers, fetchImpl)
          console.log(`[apiFetch] Direct fetch successful after proxy failure`, {
            path,
            status: directRes.status,
            attempt: attempt + 1,
            timestamp: new Date().toISOString()
          })
          return directRes
        } catch (directError) {
          console.error('[apiFetch] Direct fetch also failed:', directError)
          // Continue with normal retry logic
        }
      }
      
      // Si falla (405/5xx), intentar directo al backend solo si es mismo origen
      if (!res.ok && [502, 503, 504, 405].includes(res.status)) {
        const sameOrigin = (typeof window !== 'undefined') ? (new URL(BASE_URL).origin === window.location.origin) : true
        if (sameOrigin) {
          try {
            lastUrlTried = directUrl
            res = await fetchWithTimeout(fetchImpl, directUrl, { ...init, headers }, 12000)
          } catch (e2) {
            lastError = e2
          }
        }
      }
      if (!res.ok && [502, 503, 504].includes(res.status)) {
        try { fetch('/api/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: Date.now(), path, url: lastUrlTried, status: res.status, attempt }) }) } catch {}
        recordFailure() // Record failure for circuit breaker
      }
      if (!res.ok && [502, 503, 504].includes(res.status) && attempt < maxRetries - 1) {
        // Enhanced retry with exponential backoff and pre-warming
        const backoffMs = calculateBackoff(attempt, 600)
        console.warn(`[apiFetch] Retry ${attempt + 1}/${maxRetries} after ${backoffMs}ms for ${path} (status: ${res.status})`)
        await warmupBackend(fetchImpl, '/api/proxy', BASE_URL)
        await sleep(backoffMs)
        continue
      }
      
      // Record success if we get a valid response
      if (res.ok) {
        recordSuccess()
      }
      
      return res
    } catch (e) {
      lastError = e
      recordFailure() // Record network failures
      
      // On network error, try direct fetch immediately
      if (attempt === 0) {
        console.warn('[apiFetch] Network error on first attempt, trying direct fetch', {
          path,
          error: e,
          timestamp: new Date().toISOString()
        })
        try {
          const directRes = await directFetch(path, init, headers, fetchImpl)
          console.log(`[apiFetch] Direct fetch successful after network error`, {
            path,
            status: directRes.status,
            timestamp: new Date().toISOString()
          })
          return directRes
        } catch (directError) {
          console.error('[apiFetch] Direct fetch also failed:', directError)
        }
      }
      
      if (attempt < maxRetries - 1) {
        // Enhanced retry for network/timeout errors
        const backoffMs = calculateBackoff(attempt, 700)
        console.warn(`[apiFetch] Network retry ${attempt + 1}/${maxRetries} after ${backoffMs}ms for ${path}`, e)
        await warmupBackend(fetchImpl, '/api/proxy', BASE_URL)
        await sleep(backoffMs)
        continue
      }
    }
  }
  
  const error = lastError instanceof Error ? lastError : new Error('API request failed')
  if (!(lastError instanceof Error)) {
    ;(error as { cause?: unknown }).cause = lastError
  }
  ;(error as { url?: string }).url = lastUrlTried
  
  // Check if circuit breaker is open and add that information to the error
  if (circuitBreakerState === 'open') {
    error.message = `${error.message} (Service circuit breaker is open - too many failures)`
  }
  
  try { fetch('/api/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: Date.now(), path, url: lastUrlTried, error: (error as Error).message }) }) } catch {}
  console.error('[apiFetch] request failed after retries', { path, lastUrlTried, error })
  throw error
}
