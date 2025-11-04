import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Variables de entorno no configuradas. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para habilitar Auth. Se usará modo mock.')
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as unknown as ReturnType<typeof createClient>)

export function isSupabaseEnabled() {
  return Boolean(supabaseUrl && supabaseAnonKey)
}
