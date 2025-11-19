// Vercel Serverless Function to warm the backend (Render)
// Path: /api/warm

export default async function handler(req, res) {
  const target = process.env.BACKEND_URL || 'https://agrolinkbackend.onrender.com/actuator/health'
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 5000)
  try {
    const r = await fetch(target, { cache: 'no-store', signal: controller.signal })
    const text = await r.text().catch(() => '')
    res.status(200).json({ ok: true, status: r.status, body: text.slice(0, 200) })
  } catch (e) {
    res.status(200).json({ ok: false, error: (e && e.message) || 'fetch failed' })
  } finally {
    clearTimeout(id)
  }
}
