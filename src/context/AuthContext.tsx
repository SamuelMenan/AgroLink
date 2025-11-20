import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { deriveUserFromTokens, signInEmail, signInPhone, signUp, signOut as backendSignOut, refreshSession, getAccessToken, getOAuthStartUrl, clearTokens, type AuthUser } from '../services/apiAuth'

type User = AuthUser

type AuthContextValue = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  signUpWithEmail: (params: { fullName: string; email: string; password: string; phone?: string }) => Promise<{ error?: string }>
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
            if (mounted) {
              setUser(u)
            }
          } catch (err) {
            console.error('[AuthProvider] refreshSession failed during init', err)
            clearTokens()
            if (mounted) setUser(null)
          }
        } else if (mounted) {
          setUser(null)
        }
      } catch (err) {
        console.error('[AuthProvider] init failed', err)
        clearTokens()
        if (mounted) setUser(null)
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

/**
 * Registra un nuevo usuario por email o teléfono.
 * 
 * IMPORTANTE: Requiere que la confirmación de email esté desactivada en la configuración de Supabase.
 * Si no se desactiva, el sistema mostrará warnings en consola y el acceso será limitado
 * cuando no se reciban tokens de autenticación.
 * 
 * @param fullName - Nombre completo del usuario
 * @param email - Email del usuario (opcional si se proporciona teléfono)
 * @param password - Contraseña del usuario
 * @param phone - Teléfono del usuario (opcional si se proporciona email)
 */
  const signUpWithEmail: AuthContextValue['signUpWithEmail'] = async ({ fullName, email, password, phone }) => {
    try {
      const resp = await signUp(fullName, email, password, phone)
      const u = deriveUserFromTokens(resp)
      
      // Si hay un usuario válido, establecerlo (considerar autenticado si existen tokens)
      if (u) {
        setUser(u)
      } else if (!resp.access_token) {
        // Supabase no devolvió tokens (probable confirmación activada o respuesta parcial)
        console.warn('[AuthContext] Supabase no devolvió tokens en sign-up. Intentando sign-in inmediato.')
        try {
          const signinResp = await signInEmail(email, password)
          const u2 = deriveUserFromTokens(signinResp)
          if (u2) setUser(u2)
        } catch (signinErr) {
          console.warn('[AuthContext] sign-in inmediato tras falta de tokens falló', signinErr)
        }
      }
      return {}
    } catch (e) {
      let msg = e instanceof Error ? e.message : 'Error en el registro'
      
      // Provide more user-friendly error messages
      if (/(422|user_already_exists|already registered|ya está registrado)/i.test(msg)) {
        // Intentar sign-in automático al detectar duplicado (posible segundo POST)
        try {
          const signinResp = await signInEmail(email, password)
          const uDup = deriveUserFromTokens(signinResp)
          if (uDup) {
            setUser(uDup)
            return {}
          }
        } catch (dupErr) {
          console.warn('[AuthContext] sign-in fallback tras 422 falló', dupErr)
        }
        msg = 'Este usuario ya está registrado. Inicia sesión o usa otro correo/teléfono.'
      } else if (msg.includes('400')) {
        msg = 'Los datos del formulario no son válidos. Por favor, verifica tu información.'
      } else if (msg.includes('network') || msg.includes('Network')) {
        msg = 'Error de conexión. Por favor, verifica tu conexión a internet e intenta nuevamente.'
      } else if (msg.includes('timeout')) {
        msg = 'El servidor está tardando demasiado en responder. Por favor, intenta nuevamente.'
      } else if (msg.includes('CORS') || msg.includes('cors')) {
        msg = 'Error de conexión con el servidor. Por favor, intenta nuevamente en unos momentos.'
      } else if (msg.includes('405')) {
        msg = 'Error temporal en el servidor. Por favor, intenta nuevamente.'
      }
      
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
    const redirect_to = `${window.location.origin}/oauth/callback`
    const baseUrl = getOAuthStartUrl('google', next)
    const url = `${baseUrl}&redirect_to=${encodeURIComponent(redirect_to)}`
    window.location.href = url
  }

  const signInWithFacebook = async (redirectTo?: string) => {
    const next = redirectTo || '/simple'
    const redirect_to = `${window.location.origin}/oauth/callback`
    const baseUrl = getOAuthStartUrl('facebook', next)
    const url = `${baseUrl}&redirect_to=${encodeURIComponent(redirect_to)}`
    window.location.href = url
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
