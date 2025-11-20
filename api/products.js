// Serverless handler for products: supports full CRUD (GET/POST/PATCH/DELETE) with backend warmup and fallback to Supabase direct
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function warmupBackend() {
  const backendUrl = process.env.BACKEND_URL || 'https://agrolinkbackend.onrender.com'
  console.log('[products] Starting backend warmup...')
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    const start = Date.now()
    
    await fetch(`${backendUrl}/actuator/health`, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'AgroLink-Warmup' }
    })
    
    clearTimeout(timeout)
    const elapsed = Date.now() - start
    console.log(`[products] Backend warmup completed in ${elapsed}ms`)
    
    // Give backend extra time to fully initialize
    if (elapsed < 2000) {
      await sleep(1000)
    }
  } catch (e) {
    console.warn('[products] Backend warmup failed:', e.message)
  }
}

export default async function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase()
  
  console.log('[products] Incoming request:', {
    method,
    url: req.url,
    pathname: new URL(req.url, 'http://localhost').pathname
  })
  
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

  // Parse request path and query - handle both /api/products/id and /id patterns
  const urlObj = new URL(req.url, 'http://localhost')
  let pathSuffix = ''
  
  // Try multiple patterns to extract the product ID or path suffix
  if (urlObj.pathname.includes('/api/products/')) {
    pathSuffix = urlObj.pathname.split('/api/products/')[1] || ''
  } else if (urlObj.pathname.startsWith('/') && urlObj.pathname.length > 1) {
    // Direct pattern like /839b3c5c-09ba-4401-a3fe-d646941d22b9
    pathSuffix = urlObj.pathname.substring(1)
  }
  
  const queryString = urlObj.search
  
  console.log('[products] Parsed:', { 
    pathSuffix, 
    queryString, 
    method,
    fullUrl: req.url,
    pathname: urlObj.pathname,
    searchParams: Object.fromEntries(urlObj.searchParams)
  })

  // Warmup backend BEFORE attempting main request
  console.log('[products] Warming up backend before request...')
  await warmupBackend()
  await sleep(500) // Extra buffer time

  // Try backend first
  try {
    // For GET requests with 'q' parameter, extract and use it directly
    let backendEndpoint
    const qParam = urlObj.searchParams.get('q')
    if (method === 'GET' && qParam) {
      // The 'q' param contains the actual Supabase query - pass it as query string
      backendEndpoint = `${backendUrl}/api/v1/products?${qParam}`
      console.log('[products] Using q parameter for backend:', qParam)
    } else {
      backendEndpoint = `${backendUrl}/api/v1/products${pathSuffix ? `/${pathSuffix}` : ''}${queryString}`
    }
    
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

    // Try backend with more retries and longer timeouts
    let backendResp
    let lastErr
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 25000)
        
        console.log(`[products] Attempt ${attempt + 1}/5 to backend: ${method} ${backendEndpoint}`)
        backendResp = await fetch(backendEndpoint, {
          method,
          headers: outgoingHeaders,
          body,
          signal: controller.signal
        })
        
        clearTimeout(timeout)
        console.log(`[products] Backend response: ${backendResp.status}`)
        
        // Success or client error (except 405 which indicates backend routing issue)
        if (backendResp.ok || (backendResp.status >= 400 && backendResp.status < 500 && backendResp.status !== 405)) {
          break
        }
        
        // Retry on 502/503/504
        if ([502, 503, 504].includes(backendResp.status) && attempt < 4) {
          const backoff = 1000 * (attempt + 1)
          console.log(`[products] Retrying after ${backoff}ms...`)
          await sleep(backoff)
          continue
        }
        
        break
      } catch (e) {
        lastErr = e
        console.error(`[products] Backend attempt ${attempt + 1} failed:`, e.message)
        if (attempt < 4) {
          const backoff = 1000 * (attempt + 1)
          await sleep(backoff)
          continue
        }
      }
    }

    // If backend succeeded, return its response (but not 405 errors)
    if (backendResp && backendResp.status !== 405 && (backendResp.ok || (backendResp.status >= 400 && backendResp.status < 500))) {
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

    // Backend failed - fallback to direct Supabase for ALL operations
    console.warn('[products] Backend unavailable after retries, using Supabase fallback')
    
    if (!supabaseUrl || !supabaseAnon) {
      res.status(502).json({ 
        ok: false, 
        error: 'Backend unavailable and Supabase not configured',
        details: lastErr ? lastErr.message : 'Connection failed'
      })
      return
    }

    // Handle Supabase fallback based on method
    const supabaseHeaders = {
      'accept': 'application/json',
      'content-type': 'application/json',
      'apikey': supabaseAnon,
      'Authorization': req.headers.authorization || `Bearer ${supabaseAnon}`,
      'Prefer': 'return=representation'
    }

    if (method === 'GET') {
      // Extract the 'q' parameter which contains the actual Supabase query
      const qParam = urlObj.searchParams.get('q')
      let supabaseQuery = ''
      
      if (qParam) {
        // The q parameter contains URL-encoded Supabase query params like "select=*&user_id=eq.xxx"
        // We need to pass this directly to Supabase
        supabaseQuery = qParam.startsWith('?') ? qParam : `?${qParam}`
      } else if (queryString) {
        // Fallback to using the raw query string
        supabaseQuery = queryString
      }
      
      const supabaseEndpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/products${supabaseQuery}`
      
      console.log('[products] Supabase GET fallback:', supabaseEndpoint)
      
      const supabaseResp = await fetch(supabaseEndpoint, {
        headers: supabaseHeaders,
        signal: AbortSignal.timeout(15000)
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

    if (method === 'POST') {
      const supabaseEndpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/products`
      
      const supabaseResp = await fetch(supabaseEndpoint, {
        method: 'POST',
        headers: supabaseHeaders,
        body,
        signal: AbortSignal.timeout(15000)
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

    if (method === 'PATCH' && pathSuffix) {
      const supabaseEndpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/products?id=eq.${pathSuffix}`
      
      const supabaseResp = await fetch(supabaseEndpoint, {
        method: 'PATCH',
        headers: supabaseHeaders,
        body,
        signal: AbortSignal.timeout(15000)
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

    if (method === 'DELETE' && pathSuffix) {
      const supabaseEndpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/products?id=eq.${pathSuffix}`
      
      const supabaseResp = await fetch(supabaseEndpoint, {
        method: 'DELETE',
        headers: supabaseHeaders,
        signal: AbortSignal.timeout(15000)
      })

      res.status(supabaseResp.status)
      res.end()
      return
    }

    // Unsupported operation
    res.status(400).json({ ok: false, error: 'Unsupported operation' })
    
  } catch (e) {
    console.error('[products] Handler error:', e)
    res.status(502).json({ ok: false, error: e.message || 'Request failed' })
  }
}