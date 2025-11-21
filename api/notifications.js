// Unified notifications handler
// GET  /api/notifications?user_id=...&limit=... -> list notifications
// PATCH /api/notifications?user_id=...&action=read-all -> mark all as read
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) return res.status(503).json({ error: 'Supabase no configurado' })

  const urlObj = new URL(req.url, 'http://localhost')
  const userId = urlObj.searchParams.get('user_id') || ''
  const limit = urlObj.searchParams.get('limit') || '12'
  const action = urlObj.searchParams.get('action') || null
  if (!userId) return res.status(400).json({ error: 'user_id requerido' })

  const authHeader = req.headers.authorization || `Bearer ${supabaseAnon}`

  try {
    if (req.method === 'GET' && !action) {
      const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/notifications?select=*&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=${encodeURIComponent(limit)}`
      const resp = await fetch(endpoint, {
        headers: { 'accept': 'application/json', 'content-type': 'application/json', 'apikey': supabaseAnon, 'Authorization': authHeader }
      })
      const text = await resp.text()
      if (!resp.ok) return res.status(resp.status).json({ error: 'Error al obtener notificaciones', details: text })
      res.setHeader('content-type', 'application/json')
      return res.status(200).end(text)
    } else if (req.method === 'PATCH' && action === 'read-all') {
      const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/notifications?user_id=eq.${encodeURIComponent(userId)}`
      const nowIso = new Date().toISOString()
      const resp = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'accept': 'application/json', 'content-type': 'application/json', 'apikey': supabaseAnon, 'Authorization': authHeader, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ read_at: nowIso })
      })
      if (!resp.ok) return res.status(resp.status).json({ error: 'Error al marcar como leídas', details: await resp.text() })
      return res.status(200).json({ ok: true })
    } else {
      return res.status(405).json({ error: 'Método o acción no soportada' })
    }
  } catch (e) {
    return res.status(500).json({ error: 'Error interno', message: e.message })
  }
}