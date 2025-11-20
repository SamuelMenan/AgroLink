const BASE = process.env.TEST_BASE_URL || ''
const TOKEN = process.env.TEST_ACCESS_TOKEN || ''

const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }

async function hit(method, path, body) {
  const url = `${BASE}${path}`
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  return { url, status: res.status, ok: res.ok, sample: text.slice(0, 120) }
}

async function main() {
  const out = []
  out.push(await hit('GET', '/api/proxy/actuator/health'))
  out.push(await hit('POST', '/api/proxy/api/v1/conversations'))
  if (process.env.TEST_CONV_ID) {
    out.push(await hit('POST', `/api/proxy/api/v1/conversations/${process.env.TEST_CONV_ID}/participants`, { user_id: process.env.TEST_OTHER_USER || '' }))
    out.push(await hit('POST', '/api/proxy/api/v1/messages', { conversation_id: process.env.TEST_CONV_ID, sender_id: process.env.TEST_SENDER_ID || '', plaintext: 'hola', mime_type: 'text/plain' }))
  }
  console.log(JSON.stringify(out, null, 2))
}

main().catch(e => { console.error(e && e.message); process.exit(1) })