import { isSupabaseEnabled, supabase } from './supabaseClient'
import { decryptField, encryptField } from '../utils/fieldCrypto'
// import { v4 as uuidv4 } from './uuid'

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

const LS_KEY = 'agrolink_profile_mock'

function getLocal(): Profile | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}
function setLocal(p: Profile) {
  localStorage.setItem(LS_KEY, JSON.stringify(p))
}

export async function getMyProfile(userId: string): Promise<Profile> {
  if (!isSupabaseEnabled()) {
    let p = getLocal()
    if (!p) {
      p = {
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
      setLocal(p)
    }
    return p
  }
  // Fetch
  const { data, error } = await supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) {
    // Initialize from auth metadata
    const { data: auth } = await supabase.auth.getUser()
    const meta = auth.user?.user_metadata || {}
    const insert = {
      user_id: userId,
      full_name: meta.full_name ?? null,
      email: auth.user?.email ?? null,
      phone: meta.phone ?? null,
      address_enc: null as string | null,
      name_visibility: 'contacts' as Visibility,
      email_visibility: 'contacts' as Visibility,
      phone_visibility: 'contacts' as Visibility,
      address_visibility: 'private' as Visibility,
    }
    const { data: created, error: insErr } = await supabase.from('user_profiles').insert(insert).select('*').single()
    if (insErr) throw new Error(insErr.message)
    return {
      user_id: created.user_id,
      full_name: created.full_name,
      email: created.email,
      phone: created.phone,
      address: '',
      name_visibility: created.name_visibility,
      email_visibility: created.email_visibility,
      phone_visibility: created.phone_visibility,
      address_visibility: created.address_visibility,
      created_at: created.created_at,
      updated_at: created.updated_at,
    }
  }
  // Decrypt address
  const address = await decryptField((data as { address_enc?: string | null }).address_enc ?? null)
  return {
    user_id: data.user_id,
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
    address,
    name_visibility: data.name_visibility,
    email_visibility: data.email_visibility,
    phone_visibility: data.phone_visibility,
    address_visibility: data.address_visibility,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

export type ProfilePatch = Partial<Pick<Profile, 'full_name' | 'email' | 'phone' | 'address' | 'name_visibility' | 'email_visibility' | 'phone_visibility' | 'address_visibility'>>

export async function saveMyProfile(userId: string, patch: ProfilePatch): Promise<Profile> {
  if (!isSupabaseEnabled()) {
    let p = getLocal()
    if (!p) p = await getMyProfile(userId)
    p = { ...p, ...patch, updated_at: new Date().toISOString() }
    setLocal(p)
    return p
  }
  // Encrypt address if present
  let address_enc: string | undefined
  if (patch.address !== undefined) {
    address_enc = await encryptField(patch.address || '')
  }
  const update: Record<string, unknown> = {
    ...(patch.full_name !== undefined ? { full_name: patch.full_name } : {}),
    ...(patch.email !== undefined ? { email: patch.email } : {}),
    ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
    ...(address_enc !== undefined ? { address_enc } : {}),
    ...(patch.name_visibility !== undefined ? { name_visibility: patch.name_visibility } : {}),
    ...(patch.email_visibility !== undefined ? { email_visibility: patch.email_visibility } : {}),
    ...(patch.phone_visibility !== undefined ? { phone_visibility: patch.phone_visibility } : {}),
    ...(patch.address_visibility !== undefined ? { address_visibility: patch.address_visibility } : {}),
  }
  const { data, error } = await supabase.from('user_profiles').update(update).eq('user_id', userId).select('*').single()
  if (error) throw new Error(error.message)

  // Also reflect in auth metadata if name/phone changed, and email if changed
  const meta: Record<string, unknown> = {}
  if (patch.full_name !== undefined) meta.full_name = patch.full_name
  if (patch.phone !== undefined) meta.phone = patch.phone
  if (Object.keys(meta).length) {
    await supabase.auth.updateUser({ data: meta })
  }
  if (patch.email !== undefined) {
    await supabase.auth.updateUser({ email: patch.email ?? undefined }) // may require confirmation
  }

  const addr = await decryptField((data as { address_enc?: string | null }).address_enc ?? null)
  return {
    user_id: data.user_id,
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
    address: addr,
    name_visibility: data.name_visibility,
    email_visibility: data.email_visibility,
    phone_visibility: data.phone_visibility,
    address_visibility: data.address_visibility,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

export async function changeMyPassword(newPassword: string): Promise<void> {
  if (!isSupabaseEnabled()) return
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}
