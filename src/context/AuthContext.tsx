import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User as SupaUser, SignInWithPasswordCredentials } from '@supabase/supabase-js'
import { supabase, isSupabaseEnabled } from '../services/supabaseClient'

type User = {
  id: string
  email?: string
  phone?: string
  full_name?: string
}

type AuthContextValue = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  signUpWithEmail: (params: { fullName: string; email: string; password: string; phone?: string }) => Promise<{ needsEmailConfirmation?: boolean; error?: string }>
  signInWithEmail: (params: { email: string; password: string }) => Promise<{ error?: string }>
  signInWithCredentials: (params: { identifier: string; password: string }) => Promise<{ error?: string }>
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  signInWithFacebook: (redirectTo?: string) => Promise<void>
  resetPassword: (email: string) => Promise<{ error?: string }>
  updatePassword: (newPassword: string) => Promise<{ error?: string }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        if (isSupabaseEnabled()) {
          const { data } = await supabase.auth.getUser()
          if (mounted) setUser(data.user ? mapUser(data.user) : null)
          supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ? mapUser(session.user) : null)
          })
        } else {
          // Modo sin Supabase: sin sesión
          if (mounted) setUser(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()
    return () => {
      mounted = false
    }
  }, [])

  const signOut = async () => {
    if (!isSupabaseEnabled()) {
      setUser(null)
      return
    }
    await supabase.auth.signOut()
  }

  const signUpWithEmail: AuthContextValue['signUpWithEmail'] = async ({ fullName, email, password, phone }) => {
    if (!isSupabaseEnabled()) {
      // Mock: "crea" el usuario localmente para continuar desarrollo sin backend
      setUser({ id: 'mock', email, phone, full_name: fullName })
      return { needsEmailConfirmation: false }
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
        emailRedirectTo: `${location.origin}/dashboard`,
      },
    })
    if (error) return { error: error.message }
    // Si el proyecto requiere confirmación por email, no habrá sesión inmediata
    const needsEmailConfirmation = !data.session
    if (data.user && data.session) setUser(mapUser(data.user))
    return { needsEmailConfirmation }
  }

  const signInWithEmail: AuthContextValue['signInWithEmail'] = async ({ email, password }) => {
    if (!isSupabaseEnabled()) {
      setUser({ id: 'mock-email', email, full_name: email.split('@')[0] })
      return {}
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    if (data.user) setUser(mapUser(data.user))
    return {}
  }

  const signInWithGoogle = async (redirectTo?: string) => {
    if (!isSupabaseEnabled()) {
      setUser({ id: 'mock-google', email: 'mock.google@example.com', full_name: 'Usuario Google' })
      return
    }
    const dest = redirectTo ?? `${location.origin}/dashboard`
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: dest } })
  }

  const signInWithFacebook = async (redirectTo?: string) => {
    if (!isSupabaseEnabled()) {
      setUser({ id: 'mock-facebook', email: 'mock.facebook@example.com', full_name: 'Usuario Facebook' })
      return
    }
    const dest = redirectTo ?? `${location.origin}/dashboard`
    await supabase.auth.signInWithOAuth({ provider: 'facebook', options: { redirectTo: dest } })
  }

  const signInWithCredentials: AuthContextValue['signInWithCredentials'] = async ({ identifier, password }) => {
    const normalized = identifier.trim()
    const isPhone = /^\+?\d{7,15}$/.test(normalized) || /^\d{7,15}$/.test(normalized.replace(/\s|-/g, ''))
    if (!isSupabaseEnabled()) {
      setUser({ id: 'mock-cred', email: isPhone ? undefined : normalized, phone: isPhone ? normalized : undefined, full_name: 'Usuario' })
      return {}
    }
    const creds: SignInWithPasswordCredentials = isPhone
      ? { phone: normalized, password }
      : { email: normalized, password }
    const { data, error } = await supabase.auth.signInWithPassword(creds)
    if (error) return { error: error.message }
    if (data.user) setUser(mapUser(data.user))
    return {}
  }

  const resetPassword: AuthContextValue['resetPassword'] = async (email) => {
    if (!isSupabaseEnabled()) return {}
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset-password` })
    if (error) return { error: error.message }
    return {}
  }

  const updatePassword: AuthContextValue['updatePassword'] = async (newPassword) => {
    if (!isSupabaseEnabled()) return {}
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: error.message }
    if (data.user) setUser(mapUser(data.user))
    return {}
  }

  const value = useMemo(() => ({ user, loading, signOut, signUpWithEmail, signInWithEmail, signInWithCredentials, signInWithGoogle, signInWithFacebook, resetPassword, updatePassword }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

function mapUser(u: SupaUser): User {
  return { id: u.id, email: u.email ?? undefined, phone: u.phone ?? undefined, full_name: u.user_metadata?.full_name }
}
