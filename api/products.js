// Serverless handler for products: supports full CRUD (GET/POST/PATCH/DELETE) with backend warmup and fallback to Supabase direct
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function warmupBackend() {
  const backendUrl = process.env.BACKEND_URL || 'https://agrolinkbackend.onrender.com'
  try {
    await fetch(`${backendUrl}/actuator/health`, { 
      signal: AbortSignal.timeout(3000),
      headers: { 'User-Agent': 'AgroLink-Warmup' }
    })
  } catch {
    // Ignore warmup errors
  }
}

export default async function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase()
  
  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*')
    res.status(204).end()
    return
  }

  const backendUrl = process.env.BACKEND_URL || 'https://agrolinkbackend.onrender.com'
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  // Parse request path and query
  const urlObj = new URL(req.url, 'http://localhost')
  const pathMatch = urlObj.pathname.match(/\/api\/products\/?(.*)/)
  const pathSuffix = pathMatch ? pathMatch[1] : ''
  const queryString = urlObj.search

  // Try backend first with warmup
  try {
    // Warmup backend in background for cold starts
    warmupBackend().catch(() => {})

    const backendEndpoint = `${backendUrl}/api/v1/products${pathSuffix ? `/${pathSuffix}` : ''}${queryString}`
    
    // Prepare headers from incoming request
    const outgoingHeaders = new Headers()
    if (req.headers.authorization) outgoingHeaders.set('Authorization', req.headers.authorization)
    if (req.headers['content-type']) outgoingHeaders.set('Content-Type', req.headers['content-type'])
    outgoingHeaders.set('Accept', 'application/json')

    // Get request body for POST/PATCH
    let body = null
    if (['POST', 'PATCH', 'PUT'].includes(method)) {
      const chunks = []
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      body = Buffer.concat(chunks)
    }

    // Try backend with retries
    let backendResp
    let lastErr
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)
        
        backendResp = await fetch(backendEndpoint, {
          method,
          headers: outgoingHeaders,
          body,
          signal: controller.signal
        })
        
        clearTimeout(timeout)
        
        // Success or client error (not a transient failure)
        if (backendResp.ok || (backendResp.status >= 400 && backendResp.status < 500)) {
          break
        }
        
        // Retry on 502/503/504
        if ([502, 503, 504].includes(backendResp.status) && attempt < 2) {
          await sleep(500 * (attempt + 1))
          continue
        }
        
        break
      } catch (e) {
        lastErr = e
        if (attempt < 2) {
          await sleep(500 * (attempt + 1))
          continue
        }
      }
    }

    // If backend succeeded, return its response
    if (backendResp && (backendResp.ok || (backendResp.status >= 400 && backendResp.status < 500))) {
      res.status(backendResp.status)
      backendResp.headers.forEach((value, key) => {
        const k = key.toLowerCase()
        if (!['connection','keep-alive','transfer-encoding','host'].includes(k)) {
          try { res.setHeader(key, value) } catch {}
        }
      })
      const buf = Buffer.from(await backendResp.arrayBuffer())
      res.end(buf)
      return
    }

    // Backend failed with 5xx or network error - fallback to direct Supabase for GET only
    if (method === 'GET' && supabaseUrl && supabaseAnon) {
      console.warn('[products] Backend failed, using Supabase fallback for GET')
      
      const q = urlObj.searchParams.get('q') || ''
      const supabaseEndpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/products${q ? (q.startsWith('?') ? q : `?${q}`) : ''}`
      
      const supabaseResp = await fetch(supabaseEndpoint, {
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'apikey': supabaseAnon,
          'Authorization': `Bearer ${supabaseAnon}`,
        },
        signal: AbortSignal.timeout(9000)
      })

      res.status(supabaseResp.status)
      supabaseResp.headers.forEach((v, k) => {
        const key = k.toLowerCase()
        if (!['connection','keep-alive','transfer-encoding','host','content-encoding','content-length'].includes(key)) {
          try { res.setHeader(k, v) } catch {}
        }
      })
      const buf = Buffer.from(await supabaseResp.arrayBuffer())
      res.end(buf)
      return
    }

    // No fallback available for POST/PATCH/DELETE or Supabase not configured
    res.status(502).json({ 
      ok: false, 
      error: 'Backend unavailable and no fallback for this operation',
      details: lastErr ? lastErr.message : 'Connection failed'
    })
    
  } catch (e) {
    console.error('[products] Handler error:', e)
    res.status(502).json({ ok: false, error: e.message || 'Request failed' })
  }
}