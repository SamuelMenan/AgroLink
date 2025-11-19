// Vercel Serverless Function to warm the backend (Render)
// Path: /api/warm

export default async function handler(req, res) {
  const target = process.env.BACKEND_URL || 'https://agrolinkbackend.onrender.com/actuator/health'
  const started = Date.now()
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 5000)
  try {
    console.log('[warm] fetching', target)
    const r = await fetch(target, { cache: 'no-store', signal: controller.signal })
    const text = await r.text().catch(() => '')
    console.log('[warm] status', r.status, 'elapsed', Date.now() - started, 'ms')
    res.status(200).json({ ok: true, status: r.status, body: text.slice(0, 200) })
  } catch (e) {
    console.log('[warm] error', e && e.message)
    res.status(200).json({ ok: false, error: (e && e.message) || 'fetch failed' })
  } finally {
    clearTimeout(id)
  }
}
