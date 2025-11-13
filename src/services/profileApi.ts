export type Visibility = 'public' | 'contacts' | 'private'
export type Profile = {
  user_id: string
  full_name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  name_visibility: Visibility
  email_visibility: Visibility
  phone_visibility: Visibility
  address_visibility: Visibility
  created_at?: string
  updated_at?: string
}

export type ProfilePatch = Partial<Pick<Profile, 'full_name' | 'email' | 'phone' | 'address' | 'name_visibility' | 'email_visibility' | 'phone_visibility' | 'address_visibility'>>

export async function getMyProfile(userId: string): Promise<Profile> {
  try {
    const resp = await fetch(`/api/profile/${encodeURIComponent(userId)}`)
    if (!resp.ok) throw new Error('Perfil no disponible')
    return await resp.json() as Profile
  } catch {
    return {
      user_id: userId,
      full_name: 'Usuario',
      email: 'user@example.com',
      phone: '',
      address: '',
      name_visibility: 'contacts',
      email_visibility: 'contacts',
      phone_visibility: 'contacts',
      address_visibility: 'private',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }
}

export async function saveMyProfile(userId: string, patch: ProfilePatch): Promise<Profile> {
  try {
    const resp = await fetch(`/api/profile/${encodeURIComponent(userId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
    if (!resp.ok) throw new Error('No se pudo guardar perfil')
    return await resp.json() as Profile
  } catch {
    return { user_id: userId, ...patch } as Profile
  }
}

export async function changeMyPassword(newPassword: string): Promise<void> {
  try {
    const resp = await fetch('/api/profile/password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword }),
    })
    if (!resp.ok) throw new Error('No se pudo cambiar contraseña')
  } catch {
    // Silencio en stub
  }
}