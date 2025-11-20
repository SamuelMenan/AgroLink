export default async function handler(req, res) {
  if ((req.method || 'GET').toUpperCase() !== 'POST') {
    res.status(405).json({ ok: false })
    return
  }
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    const now = new Date().toISOString()
    console.log('[metrics]', now, body)
    res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[metrics] error', e && e.message)
    res.status(200).json({ ok: false })
  }
}