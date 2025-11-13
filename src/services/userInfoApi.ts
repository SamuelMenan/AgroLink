export type PublicUserInfo = { id: string; full_name?: string | null; email?: string | null; location?: string | null; phone?: string | null }

// Stub que consulta backend (cuando exista) o devuelve datos ficticios.
export async function fetchUsersInfo(ids: string[]): Promise<Record<string, PublicUserInfo>> {
  if (!ids.length) return {}
  try {
    const resp = await fetch('/api/users/public-info', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
    })
    if (!resp.ok) throw new Error('Backend público info no disponible')
    const data = await resp.json() as PublicUserInfo[]
    return data.reduce<Record<string, PublicUserInfo>>((acc, row) => { acc[row.id] = row; return acc }, {})
  } catch {
    // Fallback simple
    const map: Record<string, PublicUserInfo> = {}
    ids.forEach(id => { map[id] = { id, full_name: 'Usuario', email: 'usuario@example.com', location: null, phone: null } })
    return map
  }
}