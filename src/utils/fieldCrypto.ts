// Field-level encryption for sensitive profile data (e.g., address) using AES-GCM.
// Key is generated locally and stored in localStorage. This helps protect data at rest in DB.

const KEY_STORAGE = 'agrolink_field_kek_v1'

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function importKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt'])
}

async function getOrCreateKey(): Promise<CryptoKey> {
  let b64 = localStorage.getItem(KEY_STORAGE)
  if (!b64) {
    const raw = crypto.getRandomValues(new Uint8Array(32)) // 256-bit
    b64 = arrayBufferToBase64(raw.buffer)
    localStorage.setItem(KEY_STORAGE, b64)
  }
  const raw = base64ToArrayBuffer(b64)
  return importKey(raw)
}

export async function encryptField(plain: string | null | undefined): Promise<string> {
  if (!plain) return ''
  if (!('crypto' in window) || !crypto.subtle) return plain
  const key = await getOrCreateKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder().encode(plain)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc)
  const combined = new Uint8Array(iv.byteLength + ct.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ct), iv.byteLength)
  return arrayBufferToBase64(combined.buffer)
}

export async function decryptField(encB64: string | null | undefined): Promise<string> {
  if (!encB64) return ''
  if (!('crypto' in window) || !crypto.subtle) return encB64
  try {
    const key = await getOrCreateKey()
    const combined = new Uint8Array(base64ToArrayBuffer(encB64))
    const iv = combined.slice(0, 12)
    const ct = combined.slice(12)
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
    return new TextDecoder().decode(pt)
  } catch {
    return ''
  }
}
