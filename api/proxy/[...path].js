// Serverless proxy to the Render backend to avoid browser CORS and handle retries/timeouts

const HOP_BY_HOP = new Set([
  'connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade','host'
])

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export default async function handler(req, res) {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substr(2, 9)
  
  // Production logging
  if (process.env.ENABLE_PRODUCTION_LOGGING === 'true') {
    console.log(`[PROXY-${requestId}] Starting request:`, {
      method: req.method,
      url: req.url,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    })
  }
  
  // Production CORS configuration
  const origin = req.headers.origin
  const allowedOrigins = [
    'https://agro-link-jet.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173'
  ]
  
  const isAllowedOrigin = allowedOrigins.includes(origin)
  const corsOrigin = isAllowedOrigin ? origin : allowedOrigins[0]
  
  if ((req.method || 'GET').toUpperCase() === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin)
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.status(204).end()
    return
  }
  
  // Set CORS headers for actual requests
  res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  
  // Fix environment variable name
  const base = process.env.BACKEND_URL || process.env.VITE_BACKEND_URL || 'https://agrolinkbackend.onrender.com'
  const urlObj = new URL(req.url, 'http://localhost')
  const pathname = urlObj.pathname.replace(/^\/api\/proxy\/?/, '')
  const qs = urlObj.searchParams.toString()
  const url = `${base.replace(/\/$/, '')}/${pathname}${qs ? `?${qs}` : ''}`

  const method = req.method || 'GET'
  const outgoingHeaders = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (!k) continue
    const key = k.toLowerCase()
    if (HOP_BY_HOP.has(key)) continue
    // do not forward vercel specific headers
    if (key.startsWith('x-vercel')) continue
    outgoingHeaders.set(k, Array.isArray(v) ? v.join(',') : (v || ''))
  }

  // Explicitly set Accept to JSON when none
  if (!outgoingHeaders.has('accept')) outgoingHeaders.set('accept', '*/*')

  const makeRequest = async () => {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 20000)
    try {
      let body
      if (!['GET','HEAD'].includes(method.toUpperCase())) {
        const chunks = []
        for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        body = Buffer.concat(chunks)
        if (body.length && !outgoingHeaders.has('content-length')) outgoingHeaders.set('content-length', String(body.length))
      }
      const resp = await fetch(url, {
        method,
        headers: outgoingHeaders,
        body,
        signal: controller.signal,
      })
      return resp
    } finally { clearTimeout(id) }
  }

  let resp
  let attempt = 0
  const max = 4
  let lastErr
  for (; attempt < max; attempt++) {
    try {
      resp = await makeRequest()
      if ([502,503,504].includes(resp.status) && attempt < max - 1) {
        // Enhanced backoff with jitter to prevent thundering herd
        const jitter = Math.random() * 200
        const backoff = Math.min(600 * (attempt + 1) + jitter, 3000)
        console.warn(`[proxy] Attempt ${attempt + 1}/${max} failed with ${resp.status}, retrying after ${Math.round(backoff)}ms`)
        await sleep(backoff)
        continue
      }
      break
    } catch (e) {
      lastErr = e
      if (attempt < max - 1) { 
        const jitter = Math.random() * 100
        const backoff = 300 * (attempt + 1) + jitter
        console.warn(`[proxy] Network attempt ${attempt + 1}/${max} failed, retrying after ${Math.round(backoff)}ms:`, e && e.message)
        await sleep(backoff)
        continue 
      }
      console.error('[proxy] fetch error after retries', e && e.message)
      
      // Enhanced error handling for production
      const errorResponse = {
        ok: false,
        error: (e && e.message) || 'proxy fetch failed',
        status: 502,
        details: {
          url: url,
          method: method,
          attempts: attempt,
          timestamp: new Date().toISOString(),
          origin: origin
        }
      }
      
      // Log detailed error for debugging
      console.error('[proxy] Production error details:', JSON.stringify(errorResponse, null, 2))
      
      res.status(502).json(errorResponse)
      return
    }
  }

  // Forward status and headers (excluding hop-by-hop)
  res.status(resp.status)
  resp.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      try { res.setHeader(key, value) } catch {}
    }
  })
  const buf = Buffer.from(await resp.arrayBuffer())
  
  // Production logging for request completion
  if (process.env.ENABLE_PRODUCTION_LOGGING === 'true') {
    const duration = Date.now() - startTime
    console.log(`[PROXY-${requestId}] Request completed:`, {
      status: resp.status,
      statusText: resp.statusText,
      duration: `${duration}ms`,
      contentLength: buf.length,
      timestamp: new Date().toISOString()
    })
  }
  
  res.end(buf)
}
