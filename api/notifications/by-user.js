// c:\Users\sam10\OneDrive\Documentos\AgroLink\api\notifications\by-user.js
export default async function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase()
  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*')
    res.status(204).end()
    return
  }
  if (method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const urlObj = new URL(req.url, 'http://localhost')
  const userId = urlObj.searchParams.get('user_id') || ''
  const limit = urlObj.searchParams.get('limit') || '12'
  if (!userId) {
    res.status(400).json({ error: 'user_id requerido' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) {
    res.status(503).json({ error: 'Supabase no configurado' })
    return
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/notifications?select=*` +
                   `&user_id=eq.${encodeURIComponent(userId)}` +
                   `&order=created_at.desc&limit=${encodeURIComponent(limit)}`

  const authHeader = req.headers['authorization']
  const headers = {
    'accept': 'application/json',
    'content-type': 'application/json',
    'apikey': supabaseAnon,
    'Authorization': (typeof authHeader === 'string' && authHeader.length) ? authHeader : `Bearer ${supabaseAnon}`,
  }

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 9000)
  try {
    let resp
    let lastErr
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        resp = await fetch(endpoint, { headers, signal: controller.signal })
        if (![502,503,504].includes(resp.status)) break
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
      } catch (e) {
        lastErr = e
        if (attempt < 2) await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
      }
    }
    if (!resp) {
      res.status(502).json({ ok: false, error: (lastErr && lastErr.message) || 'fetch failed' })
      return
    }
    res.status(resp.status)
    resp.headers.forEach((v, k) => {
      const key = k.toLowerCase()
      if (!['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade','host','content-encoding','content-length'].includes(key)) {
        try { res.setHeader(k, v) } catch {}
      }
    })
    if (!res.getHeader('content-type')) { try { res.setHeader('content-type', 'application/json') } catch {} }
    const buf = Buffer.from(await resp.arrayBuffer())
    res.end(buf)
  } finally {
    clearTimeout(id)
  }
}