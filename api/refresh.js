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

  // Skip backend warmup - go directly to Supabase for refresh
  // Refresh tokens don't need backend processing, direct to Supabase is faster
  
  // Parse request body
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const body = Buffer.concat(chunks)
  const bodyJson = body.length ? (() => { try { return JSON.parse(body.toString('utf8')) } catch { return {} } })() : {}
  
  console.log('[refresh] Using direct Supabase (faster than backend)')
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnon) {
    res.status(502).json({ ok: false, error: 'Supabase configuration missing' })
    return
  }
  
  try {
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`
    const sb = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'accept': 'application/json', 
        'apikey': supabaseAnon, 
        'Authorization': `Bearer ${supabaseAnon}` 
      },
      body: JSON.stringify({ refresh_token: bodyJson.refresh_token }),
      signal: AbortSignal.timeout(5000) // 5s timeout for Supabase
    })
    
    const text = await sb.text()
    res.status(sb.status)
    res.setHeader('content-type', 'application/json')
    console.log('[refresh] Supabase response:', sb.status)
    res.end(text)
  } catch (e) {
    console.error('[refresh] Supabase error:', e.message)
    res.status(502).json({ ok: false, error: e.message || 'Refresh failed' })
  }
}