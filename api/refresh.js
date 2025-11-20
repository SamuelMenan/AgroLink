// Serverless refresh handler with aggressive warmup and Supabase fallback
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function warmupBackend() {
  const base = process.env.BACKEND_URL || 'https://agrolinkbackend.onrender.com'
  console.log('[refresh] Starting backend warmup...')
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    const start = Date.now()
    
    await fetch(`${base}/actuator/health`, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'AgroLink-Warmup' },
      cache: 'no-store'
    })
    
    clearTimeout(timeout)
    const elapsed = Date.now() - start
    console.log(`[refresh] Backend warmup completed in ${elapsed}ms`)
    
    if (elapsed < 2000) {
      await sleep(1000)
    }
  } catch (e) {
    console.warn('[refresh] Backend warmup failed:', e.message)
  }
}

// Configure allowed methods for Vercel
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  const method = (req.method || 'POST').toUpperCase()
  
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
  
  console.log('[refresh] Incoming request:', { method })
  
  if (method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const base = process.env.BACKEND_URL || 'https://agrolinkbackend.onrender.com'
  const url = `${base.replace(/\/$/, '')}/api/v1/auth/refresh`
  
  // Aggressive warmup BEFORE attempting refresh
  await warmupBackend()
  await sleep(500)
  
  const HOP = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade','host'])
  const out = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (!k) continue
    const key = k.toLowerCase()
    if (HOP.has(key)) continue
    if (key.startsWith('x-vercel')) continue
    out.set(k, Array.isArray(v) ? v.join(',') : (v || ''))
  }
  if (!out.has('content-type')) out.set('content-type', 'application/json')
  out.set('accept', 'application/json')

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 20000) // Increased to 20s
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    const body = Buffer.concat(chunks)
    const bodyJson = body.length ? (() => { try { return JSON.parse(body.toString('utf8')) } catch { return {} } })() : {}
    if (body.length && !out.has('content-length')) out.set('content-length', String(body.length))

    let resp
    let err
    for (let attempt = 0; attempt < 5; attempt++) { // Increased to 5 attempts
      try {
        console.log(`[refresh] Attempt ${attempt + 1}/5 to backend`)
        resp = await fetch(url, { method: 'POST', headers: out, body, signal: controller.signal })
        console.log(`[refresh] Backend response: ${resp.status}`)
        if (![502,503,504].includes(resp.status)) break
        const backoff = 800 * (attempt + 1) // Longer backoff
        console.log(`[refresh] Retrying after ${backoff}ms...`)
        await sleep(backoff)
      } catch (e) {
        err = e
        console.error(`[refresh] Attempt ${attempt + 1} failed:`, e.message)
        if (attempt < 4) {
          const backoff = 800 * (attempt + 1)
          await sleep(backoff)
        }
      }
    }
    if (!resp || (resp.status >= 500 && resp.status <= 599)) {
      console.warn('[refresh] Backend unavailable, using Supabase fallback')
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
      const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
      if (supabaseUrl && supabaseAnon) {
        const endpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`
        const sb = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'accept': 'application/json', 'apikey': supabaseAnon, 'Authorization': `Bearer ${supabaseAnon}` },
          body: JSON.stringify({ refresh_token: bodyJson.refresh_token }),
          signal: AbortSignal.timeout(10000)
        })
        const text = await sb.text()
        res.status(sb.ok ? sb.status : 502)
        res.setHeader('content-type', 'application/json')
        console.log('[refresh] Supabase fallback:', sb.status)
        res.end(text)
        return
      }
      res.status(502).json({ ok: false, error: (err && err.message) || 'Backend and Supabase unavailable' })
      return
    }
    res.status(resp.status)
    resp.headers.forEach((value, key) => { if (!HOP.has(key.toLowerCase())) { try { res.setHeader(key, value) } catch {} } })
    const buf = Buffer.from(await resp.arrayBuffer())
    res.end(buf)
  } finally {
    clearTimeout(id)
  }
}