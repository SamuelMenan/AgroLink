// Minimal crypto utilities for messagingService
// AES-GCM 256-bit key generation, storage, encryption/decryption.
// Works in browser (Web Crypto). For Node dev server, globalThis.crypto is available in recent Node versions.

const subtle = globalThis.crypto?.subtle
if (!subtle) {
  console.warn('[crypto] Web Crypto API no disponible; cifrado degradado a texto plano.')
}

// Generate a new random AES-GCM key (256-bit)
export async function generateConversationKey(): Promise<CryptoKey> {
  if (!subtle) throw new Error('WebCrypto no disponible')
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

// Export a CryptoKey to base64 raw bytes
export async function exportKeyBase64(key: CryptoKey): Promise<string> {
  if (!subtle) throw new Error('WebCrypto no disponible')
  const raw = await subtle.exportKey('raw', key)
  return bytesToBase64(new Uint8Array(raw))
}

// Import base64 raw key into CryptoKey
export async function importKeyBase64(b64: string): Promise<CryptoKey> {
  if (!subtle) throw new Error('WebCrypto no disponible')
  const bytes = base64ToBytes(b64)
  return subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

// Local storage helpers
const LS_PREFIX = 'conv_key:'
export function storeKey(conversationId: string, b64: string): void {
  try { localStorage.setItem(LS_PREFIX + conversationId, b64) } catch { /* ignore */ }
}
export function getStoredKey(conversationId: string): string | null {
  try { return localStorage.getItem(LS_PREFIX + conversationId) } catch { return null }
}

// Encrypt plaintext with key -> returns iv + ciphertext (base64)
export async function encryptText(key: CryptoKey, plaintext: string): Promise<{ ivB64: string; ctB64: string }> {
  if (!subtle) {
    // Fallback: no encryption
    return { ivB64: '', ctB64: bytesToBase64(new TextEncoder().encode(plaintext)) }
  }
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const ctBuf = await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  const ct = new Uint8Array(ctBuf)
  return { ivB64: bytesToBase64(iv), ctB64: bytesToBase64(ct) }
}

// Decrypt ciphertext with key
export async function decryptText(key: CryptoKey, ivB64: string, ctB64: string): Promise<string> {
  if (!subtle) {
    // Fallback: treat ctB64 as plaintext base64
    try { return new TextDecoder().decode(base64ToBytes(ctB64)) } catch { return ctB64 }
  }
  const iv = base64ToBytes(ivB64)
  const ct = base64ToBytes(ctB64)
  const ptBuf = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(ptBuf)
}

// Utility encoders
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

// (Optional) Derive deterministic key from participants; not currently used but placeholder
export async function deriveConversationKey(userA: string, userB: string): Promise<CryptoKey> {
  const sorted = [userA, userB].sort().join(':')
  const data = new TextEncoder().encode(sorted)
  if (!subtle) throw new Error('WebCrypto no disponible')
  const hashBuf = await subtle.digest('SHA-256', data)
  const hashBytes = new Uint8Array(hashBuf)
  // Use first 32 bytes directly as raw key
  return subtle.importKey('raw', hashBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}
