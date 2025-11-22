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

// CORS-aware endpoint tracking
const corsCompatibleEndpoints = new Set<string>()
const corsIncompatibleEndpoints = new Set<string>()

function isEndpointCorsCompatible(path: string): boolean {
  // Check if we've already determined this endpoint's CORS compatibility
  if (corsCompatibleEndpoints.has(path)) return true
  if (corsIncompatibleEndpoints.has(path)) return false
  
  // Default to trying direct fetch for unknown endpoints
  return true
}

function recordCorsCompatibility(path: string, compatible: boolean) {
  const endpoint = path.split('/').slice(0, 4).join('/') // Get base endpoint path
  if (compatible) {
    corsCompatibleEndpoints.add(endpoint)
    corsIncompatibleEndpoints.delete(endpoint)
  } else {
    corsIncompatibleEndpoints.add(endpoint)
    corsCompatibleEndpoints.delete(endpoint)
  }
}

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

let warmupRan = false
async function warmupBackend(fetchImpl: FetchLike, proxyUrlBase: string, isProd: boolean, force = false) {
  if (warmupRan && !force) return
  try {
    await fetchImpl(`${proxyUrlBase}/actuator/health`, { cache: 'no-store' })
    await new Promise(r => setTimeout(r, 500))
  } catch { /* ignore */ }
  if (isProd) {
    try {
      await fetchImpl(`/api/warm`, { cache: 'no-store' })
    } catch { /* ignore */ }
  }
  warmupRan = true
}

// Direct fallback fetch that bypasses the proxy - DISABLED for products to avoid CORS
async function directFetch(path: string, init: RequestInit, headers: Headers, fetchImpl: FetchLike): Promise<Response> {
  // Skip direct fetch for /api/v1/products to avoid CORS issues
  if (path.includes('/api/v1/products')) {
    throw new Error('Direct fetch disabled for products endpoint to avoid CORS')
  }
  
  const directUrl = `${BASE_URL}${path}`
  try {
    console.warn('[apiFetch] Attempting direct fetch to backend:', directUrl)
    const res = await fetchWithTimeout(fetchImpl, directUrl, { ...init, headers }, 15000)
    
    // Treat 409 (Conflict) as success for idempotent operations like adding participants
    if (res.status === 409) {
      console.log('[apiFetch] Direct fetch successful (409 Conflict treated as success)')
      recordSuccess()
    } else if (res.ok) {
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
    // Check if it's a CORS error
    if (e instanceof Error && e.message.includes('CORS')) {
      console.error('[apiFetch] CORS policy blocking direct access - endpoint may not allow cross-origin requests')
    }
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

  const normalizedPath = path.startsWith('/api/orders') ? path.replace('/api/orders', '/api/v1/orders') : path
  const directUrl = `${BASE_URL}${normalizedPath}`
  const isProd = import.meta.env.PROD
  const shouldProxy = isProd && (normalizedPath.startsWith('/api/v1') || normalizedPath.startsWith('/api/proxy'))
  const proxiedPath = normalizedPath.startsWith('/api/proxy')
    ? path
    : (shouldProxy
        ? (normalizedPath.startsWith('/') ? `/api/proxy${normalizedPath}` : `/api/proxy/${normalizedPath}`)
        : normalizedPath)
  const proxyUrl = proxiedPath

  // Enhanced logging for production debugging
  const endpointPath = normalizedPath.split('/').slice(0, 4).join('/')
  console.log('[apiFetch] Starting request:', {
    path,
    baseUrl: BASE_URL,
    proxyUrl,
    directUrl,
    circuitBreakerState,
    circuitBreakerFailures,
    endpoint: endpointPath,
    corsCompatible: isEndpointCorsCompatible(endpointPath),
    knownCompatibleEndpoints: Array.from(corsCompatibleEndpoints),
    knownIncompatibleEndpoints: Array.from(corsIncompatibleEndpoints),
    timestamp: new Date().toISOString()
  })

  // In PROD, when origins differ, force proxy-only to avoid CORS/gateway noise

  const maxRetries = 2
  let lastError: unknown = null
  let lastUrlTried = directUrl

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Primary attempt: use proxy in PROD; in DEV access 
      const primary = proxyUrl
      lastUrlTried = primary
      
      // Increase timeout for products to allow backend warmup
      const isProductOp = normalizedPath.includes('/api/v1/products')
      const timeout = isProductOp ? 15000 : 8000
      
      console.log(`[apiFetch] Attempt ${attempt + 1}/${maxRetries} via ${shouldProxy ? 'proxy' : 'same-origin'}:`, primary, `timeout: ${timeout}ms`)
      let res = await fetchWithTimeout(fetchImpl, primary, { ...init, headers }, timeout)
      
      // If proxy fails with 405/502/503/504, immediately try direct fetch (if endpoint supports CORS)
      if (!res.ok && [405, 502, 503, 504].includes(res.status)) {
        const endpointPath = normalizedPath.split('/').slice(0, 4).join('/')
        
        if (isEndpointCorsCompatible(endpointPath)) {
          console.warn(`[apiFetch] Proxy failed with ${res.status}, attempting direct fetch`, {
            path,
            status: res.status,
            statusText: res.statusText,
            attempt: attempt + 1,
            endpoint: endpointPath,
            corsCompatible: true,
            timestamp: new Date().toISOString()
          })
          try {
            const directRes = await directFetch(normalizedPath, init, headers, fetchImpl)
            // Record that this endpoint works with direct access
            recordCorsCompatibility(endpointPath, true)
            
            // Treat 409 (Conflict) as success for idempotent operations
            if (directRes.status === 409) {
              console.log(`[apiFetch] Direct fetch successful (409 Conflict treated as success)`, {
                path,
                status: directRes.status,
                attempt: attempt + 1,
                timestamp: new Date().toISOString()
              })
              return directRes
            }
            console.log(`[apiFetch] Direct fetch successful after proxy failure`, {
              path,
              status: directRes.status,
              attempt: attempt + 1,
              timestamp: new Date().toISOString()
            })
            return directRes
          } catch (directError) {
            console.error('[apiFetch] Direct fetch also failed:', directError)
            // Record that this endpoint doesn't work with direct access
            if (directError instanceof Error && directError.message.includes('CORS')) {
              recordCorsCompatibility(endpointPath, false)
              console.warn(`[apiFetch] Endpoint ${endpointPath} marked as CORS-incompatible`)
            }
            // Continue with normal retry logic
          }
        } else {
          console.warn(`[apiFetch] Skipping direct fetch for CORS-incompatible endpoint: ${endpointPath}`)
        }
      }
      
      // Si falla (405/5xx), intentar directo al backend solo si es mismo origen
      if (!res.ok && [405, 502, 503, 504].includes(res.status)) {
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
      if (!res.ok && [405, 502, 503, 504].includes(res.status)) {
        try { fetch('/api/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: Date.now(), path, url: lastUrlTried, status: res.status, attempt }) }) } catch {
          // Silently ignore metrics errors
        }
        recordFailure() // Record failure for circuit breaker
      }
      if (!res.ok && [405, 502, 503, 504].includes(res.status) && attempt < maxRetries - 1) {
        // Enhanced retry with exponential backoff and pre-warming
        const backoffMs = calculateBackoff(attempt, 600)
        console.warn(`[apiFetch] Retry ${attempt + 1}/${maxRetries} after ${backoffMs}ms for ${path} (status: ${res.status})`)
        await warmupBackend(fetchImpl, isProd ? '/api/proxy' : '/api', isProd)
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
      
      // On network error, try direct fetch immediately (if endpoint supports CORS)
      if (attempt === 0) {
        const endpointPath = normalizedPath.split('/').slice(0, 4).join('/')
        
        if (isEndpointCorsCompatible(endpointPath)) {
          console.warn('[apiFetch] Network error on first attempt, trying direct fetch', {
            path,
            error: e,
            endpoint: endpointPath,
            corsCompatible: true,
            timestamp: new Date().toISOString()
          })
          try {
            const directRes = await directFetch(normalizedPath, init, headers, fetchImpl)
            // Record that this endpoint works with direct access
            recordCorsCompatibility(endpointPath, true)
            
            console.log(`[apiFetch] Direct fetch successful after network error`, {
              path,
              status: directRes.status,
              timestamp: new Date().toISOString()
            })
            return directRes
          } catch (directError) {
            console.error('[apiFetch] Direct fetch also failed:', directError)
            // Record that this endpoint doesn't work with direct access
            if (directError instanceof Error && (directError.message.includes('CORS') || directError.message.includes('blocked'))) {
              recordCorsCompatibility(endpointPath, false)
              console.warn(`[apiFetch] Endpoint ${endpointPath} marked as CORS-incompatible due to:`, directError.message)
            }
          }
        } else {
          console.warn(`[apiFetch] Skipping direct fetch for CORS-incompatible endpoint: ${endpointPath}`)
        }
      }
      
      if (attempt < maxRetries - 1) {
        // Enhanced retry for network/timeout errors
        const backoffMs = calculateBackoff(attempt, 700)
        console.warn(`[apiFetch] Network retry ${attempt + 1}/${maxRetries} after ${backoffMs}ms for ${path}`, e)
        await warmupBackend(fetchImpl, isProd ? '/api/proxy' : '/api', isProd)
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
  
  try {
    const enableMetrics = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_ENABLE_METRICS
    if (enableMetrics === 'true') {
      fetch('/api/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: Date.now(), path, url: lastUrlTried, error: (error as Error).message }) })
    }
  } catch {
    // Silently ignore metrics errors
  }
  console.error('[apiFetch] request failed after retries', { path, lastUrlTried, error })
  throw error
}

// Export apiClient object for compatibility
export const apiClient = {
  get: async <T>(path: string): Promise<T> => {
    const res = await apiFetch(path)
    return res.json()
  },
  post: async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    })
    return res.json()
  },
  put: async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await apiFetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    })
    return res.json()
  },
  delete: async (path: string): Promise<void> => {
    await apiFetch(path, { method: 'DELETE' })
  }
}
