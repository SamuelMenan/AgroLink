const API_BASE = '/api/v1/users'

export type PublicUserInfo = {
  id: string
  full_name: string
  email: string
  phone: string | null
}

export async function fetchUsersInfo(ids: string[]): Promise<Record<string, PublicUserInfo>> {
  if (!ids.length) return {}

  try {
    const resp = await fetch(`${API_BASE}/public-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })

    // Cualquier código no 2xx hace que usemos fallback
    if (!resp.ok) {
      throw new Error(`PUBLIC_INFO_ERROR_${resp.status}`)
    }

    const data = await resp.json()

    const map: Record<string, PublicUserInfo> = {}

    for (const row of data) {
      // Supabase suele devolver user_id; si en algún momento aliasas a id, también lo soportamos
      const uid: string | undefined = row.user_id || row.id
      if (!uid) continue

      map[uid] = {
        id: uid,
        full_name: row.full_name ?? 'Usuario',
        email: row.email ?? '',
        phone: row.phone ?? null,
      }
    }

    return map
  } catch {
    // Fallback simple: no lanzamos error hacia Messages.tsx
    const map: Record<string, PublicUserInfo> = {}

    ids.forEach(id => {
      map[id] = {
        id,
        full_name: 'Usuario',
        email: 'usuario@example.com',
        phone: null,
      }
    })

    return map
  }
}