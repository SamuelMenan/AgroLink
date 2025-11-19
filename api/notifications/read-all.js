// c:\Users\sam10\OneDrive\Documentos\AgroLink\api\notifications\read-all.js
export default async function handler(req, res) {
  const method = (req.method || 'PATCH').toUpperCase()
  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'PATCH,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*')
    res.status(204).end(); return
  }
  if (method !== 'PATCH') { res.status(405).json({ error: 'Method Not Allowed' }); return }

  const urlObj = new URL(req.url, 'http://localhost')
  const userId = urlObj.searchParams.get('user_id') || ''
  if (!userId) { res.status(400).json({ error: 'user_id requerido' }); return }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) { res.status(503).json({ error: 'Supabase no configurado' }); return }

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/notifications?user_id=eq.${encodeURIComponent(userId)}`
  const authHeader = req.headers['authorization']
  if (!authHeader || !String(authHeader).startsWith('Bearer ')) { res.status(401).json({ error: 'Authorization requerido' }); return }

  const nowIso = new Date().toISOString()
  const headers = {
    'accept': 'application/json',
    'content-type': 'application/json',
    'apikey': supabaseAnon,
    'Authorization': String(authHeader),
    'Prefer': 'return=minimal',
  }

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 9000)
  try {
    const resp = await fetch(endpoint, { method: 'PATCH', headers, body: JSON.stringify({ read_at: nowIso }), signal: controller.signal })
    res.status(resp.ok ? resp.status : 502)
    res.setHeader('content-type', 'application/json')
    const text = await resp.text().catch(()=> '')
    res.end(text || '{}')
  } catch (e) {
    res.status(502).json({ ok: false, error: (e && e.message) || 'fetch failed' })
  } finally { clearTimeout(id) }
}