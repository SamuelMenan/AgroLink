// Simple RFC4122 v4 UUID generator (not cryptographically secure)
export function v4(): string {
  // @ts-expect-error: use browser crypto if available
  const cryptoObj = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null
  const bytes = new Uint8Array(16)
  if (cryptoObj) cryptoObj.getRandomValues(bytes)
  else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'))
  return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`
}

export { v4 as uuidv4 }
