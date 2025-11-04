import { isSupabaseEnabled, supabase } from './supabaseClient'

export type PublicUserInfo = { id: string; full_name?: string | null; email?: string | null; location?: string | null; phone?: string | null }

export async function fetchUsersInfo(ids: string[]): Promise<Record<string, PublicUserInfo>> {
  if (!ids.length) return {}
  if (!isSupabaseEnabled()) {
    const map: Record<string, PublicUserInfo> = {}
    ids.forEach(id => { map[id] = { id, full_name: 'Usuario', email: 'usuario@example.com', location: null } })
    return map
  }
  const { data, error } = await supabase.rpc('get_user_public_info', { uids: ids })
  if (error) throw new Error(error.message)
  const map: Record<string, PublicUserInfo> = {}
  const rows = (data ?? []) as Array<{ id: string; full_name?: string | null; email?: string | null; location?: string | null; phone?: string | null }>
  rows.forEach((row) => {
    map[row.id] = { id: row.id, full_name: row.full_name ?? null, email: row.email ?? null, location: row.location ?? null, phone: row.phone ?? null }
  })
  return map
}
