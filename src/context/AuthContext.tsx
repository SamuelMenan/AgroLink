import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { deriveUserFromTokens, signInEmail, signInPhone, signUp, signOut as backendSignOut, refreshSession, getAccessToken, type AuthUser } from '../services/apiAuth'

type User = AuthUser

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
        const token = getAccessToken()
        if (token && mounted) {
          // Try refresh silently to get user info
          try {
            const refreshed = await refreshSession()
            const u = deriveUserFromTokens(refreshed)
            setUser(u)
          } catch {
            setUser(null)
          }
        } else if (mounted) {
          setUser(null)
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
    backendSignOut()
    setUser(null)
  }

  const signUpWithEmail: AuthContextValue['signUpWithEmail'] = async ({ fullName, email, password, phone }) => {
    try {
      const resp = await signUp(fullName, email, password, phone)
      const u = deriveUserFromTokens(resp)
      setUser(u)
      // Si el backend exige confirmación por correo, puede faltar access_token.
      const needsEmailConfirmation = !resp.access_token
      return { needsEmailConfirmation }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error registro'
      return { error: msg }
    }
  }

  const signInWithEmail: AuthContextValue['signInWithEmail'] = async ({ email, password }) => {
    try {
      const resp = await signInEmail(email, password)
      setUser(deriveUserFromTokens(resp))
      return {}
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error inicio sesión'
      return { error: msg }
    }
  }

  // Iniciar flujo OAuth: redirige al endpoint authorize de Supabase.
  // Supabase devolverá tokens en el fragmento (#access_token=...). Callback se procesa en /oauth/callback.
  const signInWithGoogle = async (redirectTo?: string) => {
    const next = redirectTo || '/simple'
    window.location.href = `/api/auth/oauth/start?provider=google&next=${encodeURIComponent(next)}`
  }

  const signInWithFacebook = async (redirectTo?: string) => {
    const next = redirectTo || '/simple'
    window.location.href = `/api/auth/oauth/start?provider=facebook&next=${encodeURIComponent(next)}`
  }

  const signInWithCredentials: AuthContextValue['signInWithCredentials'] = async ({ identifier, password }) => {
    const normalized = identifier.trim()
    const isPhone = /^\+?\d{7,15}$/.test(normalized) || /^\d{7,15}$/.test(normalized.replace(/\s|-/g, ''))
    try {
      const resp = isPhone ? await signInPhone(normalized, password) : await signInEmail(normalized, password)
      setUser(deriveUserFromTokens(resp))
      return {}
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error inicio sesión'
      return { error: msg }
    }
  }

  const resetPassword: AuthContextValue['resetPassword'] = async (_email) => {
    void _email;
    console.warn('Reset password debe implementarse via backend (email).')
    return {}
  }

  const updatePassword: AuthContextValue['updatePassword'] = async (_newPassword) => {
    void _newPassword;
    console.warn('Update password debe implementarse via backend. Usar refresh luego.')
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

// mapUser removed; backend tokens provide info
