// c:\Users\sam10\OneDrive\Documentos\AgroLink\api\products.js
export default async function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase()
  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*')
    res.status(204).end(); return
  }
  if (method !== 'GET') { res.status(405).json({ error: 'Method Not Allowed' }); return }

  const urlObj = new URL(req.url, 'http://localhost')
  const q = urlObj.searchParams.get('q') || ''
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) { res.status(503).json({ error: 'Supabase no configurado' }); return }

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/products${q ? (q.startsWith('?') ? q : `?${q}`) : ''}`
  const headers = {
    'accept': 'application/json',
    'content-type': 'application/json',
    'apikey': supabaseAnon,
    'Authorization': `Bearer ${supabaseAnon}`,
  }

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 9000)
  try {
    let resp; let err;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        resp = await fetch(endpoint, { headers, signal: controller.signal })
        if (![502,503,504].includes(resp.status)) break
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
      } catch (e) { err = e; if (attempt < 2) await new Promise(r => setTimeout(r, 300 * (attempt + 1))) }
    }
    if (!resp) { res.status(502).json({ ok:false, error: (err && err.message) || 'fetch failed' }); return }
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
  } catch (e) {
    res.status(502).json({ ok:false, error: (e && e.message) || 'fetch failed' })
  } finally { clearTimeout(id) }
}