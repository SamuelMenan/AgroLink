// Endpoint: /api/auth/guest
// Purpose: Issue an ephemeral guest identifier prior to full authentication.
// Notes:
//  - For now we only generate and return a UUID (guest_id). No DB persistence unless migration applied.
//  - If the guest_users table exists, we attempt to insert the guest record using service-level access.
//  - A future enhancement will sign a limited-scope JWT. Currently the frontend stores guest_id locally.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const { randomUUID } = require('crypto')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: 'Supabase no configurado' })
  }

  const guestId = randomUUID()
  const fingerprint = req.headers['x-client-fingerprint'] || null

  // Try to persist in guest_users (best-effort; ignore errors)
  try {
    const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/guest_users`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, // service / anon for now; RLS may block if policies tightened
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ guest_id: guestId, fingerprint })
    })
    if (!insertResp.ok) {
      const txt = await insertResp.text()
      console.warn('[guest] No se pudo insertar guest_users:', insertResp.status, txt)
    }
  } catch (e) {
    console.warn('[guest] Excepción al insertar guest_users:', e.message)
  }

  return res.status(201).json({ guest_id: guestId, created_at: new Date().toISOString() })
}
