// Simplified E2EE helpers using Web Crypto API (AES-GCM)
// NOTE: For production, use a robust key management solution. This stores keys in localStorage for demo purposes.

const ENC_ALGO = 'AES-GCM'
const KEY_BYTES = 32

function toBase64(arr: ArrayBuffer | Uint8Array): string {
  const buf = arr instanceof ArrayBuffer ? new Uint8Array(arr) : arr
  return btoa(String.fromCharCode(...buf))
}
function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function generateConversationKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ENC_ALGO, length: KEY_BYTES * 8 }, true, ['encrypt', 'decrypt'])
}

export async function exportKeyBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return toBase64(raw)
}

export async function importKeyBase64(b64: string): Promise<CryptoKey> {
  const raw = fromBase64(b64)
  const rawBuf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
  return crypto.subtle.importKey('raw', rawBuf, { name: ENC_ALGO }, true, ['encrypt', 'decrypt'])
}

export function getStoredKey(conversationId: string): string | null {
  return localStorage.getItem(`agrolink_convkey_${conversationId}`)
}
export function storeKey(conversationId: string, keyB64: string) {
  localStorage.setItem(`agrolink_convkey_${conversationId}`, keyB64)
}

export async function encryptText(key: CryptoKey, plain: string): Promise<{ ivB64: string; ctB64: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder().encode(plain)
  const ct = await crypto.subtle.encrypt({ name: ENC_ALGO, iv }, key, enc)
  return { ivB64: toBase64(iv.buffer), ctB64: toBase64(ct) }
}

export async function decryptText(key: CryptoKey, ivB64: string, ctB64: string): Promise<string> {
  const iv = fromBase64(ivB64)
  const ivBuf = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer
  const ct = fromBase64(ctB64)
  const ctBuf = ct.buffer.slice(ct.byteOffset, ct.byteOffset + ct.byteLength) as ArrayBuffer
  const pt = await crypto.subtle.decrypt({ name: ENC_ALGO, iv: ivBuf }, key, ctBuf)
  return new TextDecoder().decode(pt)
}
