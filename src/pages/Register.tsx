import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
// OAuth/confirmaciones se manejarán completamente en backend.

type Form = {
  fullName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  terms: boolean
}

const initial: Form = { fullName: '', email: '', phone: '', password: '', confirmPassword: '', terms: false }

export default function Register() {
  const [form, setForm] = useState<Form>(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { signUpWithEmail } = useAuth()
  const { signInWithGoogle, signInWithFacebook } = useAuth()
  const [googleLoading, setGoogleLoading] = useState(false)
  const [facebookLoading, setFacebookLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const nextParam = params.get('next') || '/dashboard'
  const intent = params.get('intent')
  const redirectAbs = useMemo(() => `${location.origin}${nextParam.startsWith('/') ? nextParam : '/dashboard'}`, [nextParam])

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    const sanitized = type === 'checkbox' ? checked : value.replace(/^\s+/, '')
    setForm((f) => ({ ...f, [name]: sanitized }))
  }

  function validate(): boolean {
    const e: Partial<Record<keyof Form, string>> = {}

    // Nombre completo: no vacío y <= 50
    if (!form.fullName.trim()) e.fullName = 'El nombre completo es obligatorio.'
    else if (form.fullName.trim().length > 50) e.fullName = 'Máximo 50 caracteres.'

  // Email: opcional, pero si se proporciona debe tener formato válido
    const email = form.email.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) e.email = 'Correo inválido.'

    // Teléfono: numérico, máx 10 dígitos (ahora puede ser principal)
    if (form.phone) {
      if (!/^\d{1,10}$/.test(form.phone)) e.phone = 'Solo números, máximo 10 dígitos.'
    }
    
    // Validar que al menos email o teléfono estén proporcionados
    if (!email && !form.phone) {
      e.email = 'Debes proporcionar un correo electrónico o número de teléfono.'
      e.phone = 'Debes proporcionar un correo electrónico o número de teléfono.'
    }

    // Contraseña: 8+ una mayúscula, un número y un símbolo
    const pwd = form.password
    if (!pwd) e.password = 'La contraseña es obligatoria.'
    else if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(pwd)) e.password = 'Mín 8, con mayúscula, número y símbolo.'

    // Confirmación
    if (form.confirmPassword !== form.password) e.confirmPassword = 'Las contraseñas no coinciden.'

    // Términos
    if (!form.terms) e.terms = 'Debes aceptar los términos y condiciones.'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      // En esta HU priorizamos registro por email; el teléfono se guarda en metadata
      const { error } = await signUpWithEmail({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
      })
      if (error) {
        // Enhanced error handling for different scenarios
        if (error.includes('already registered') || error.includes('User already registered') || error.includes('user_already_exists')) {
          setErrors((prev) => ({ 
            ...prev, 
            email: 'Este usuario ya está registrado. Por favor, inicia sesión o usa otro correo/teléfono.' 
          }))
        } else if (error.includes('network') || error.includes('Network')) {
          setErrors((prev) => ({ 
            ...prev, 
            email: 'Error de conexión. Por favor, verifica tu conexión a internet e intenta nuevamente.' 
          }))
        } else if (error.includes('timeout') || error.includes('Timeout')) {
          setErrors((prev) => ({ 
            ...prev, 
            email: 'La solicitud tardó demasiado tiempo. Por favor, intenta nuevamente.' 
          }))
        } else {
          setErrors((prev) => ({ ...prev, email: error }))
        }
        return
      }
      // Registro exitoso - navegar inmediatamente a /simple
      navigate('/simple', { replace: true })
    } catch (navError) {
      console.error('Error durante la navegación:', navError)
      setErrors((prev) => ({ ...prev, email: 'Error al redirigir. Por favor, intenta nuevamente.' }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-lg">
        <div className="border-b border-gray-100 p-6 md:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-green-800">Crear cuenta</h1>
          <p className="mt-1 text-sm text-gray-600">Únete a la red comercial agrícola de AgroLink.</p>
        </div>
        {intent === 'publish' && (
          <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">Crea tu cuenta para publicar tu producto. Te llevaremos a la página de publicación al registrarte.</div>
        )}
        <form onSubmit={onSubmit} className="p-6 md:p-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre completo</label>
          <input name="fullName" value={form.fullName} onChange={onChange} type="text" className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
          {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Correo electrónico (opcional)</label>
          <input name="email" value={form.email} onChange={onChange} type="email" className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Número de teléfono (opcional)</label>
          <input name="phone" value={form.phone} onChange={onChange} inputMode="numeric" pattern="[0-9]*" maxLength={10} autoComplete="username" className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
          {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Contraseña</label>
          <div className="relative">
            <input
              name="password"
              value={form.password}
              onChange={onChange}
              type={showPwd ? 'text' : 'password'}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 pr-10 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
            />
            <button
              type="button"
              aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onClick={() => setShowPwd(v => !v)}
              className="absolute inset-y-0 right-2 mt-1 flex items-center text-gray-500 hover:text-gray-700"
            >
              {showPwd ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.74-1.58 1.78-3.03 3.07-4.26" />
                  <path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42" />
                  <path d="M1 1l22 22" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Confirmar contraseña</label>
          <div className="relative">
            <input
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={onChange}
              type={showConfirmPwd ? 'text' : 'password'}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 pr-10 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
            />
            <button
              type="button"
              aria-label={showConfirmPwd ? 'Ocultar confirmación' : 'Mostrar confirmación'}
              onClick={() => setShowConfirmPwd(v => !v)}
              className="absolute inset-y-0 right-2 mt-1 flex items-center text-gray-500 hover:text-gray-700"
            >
              {showConfirmPwd ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.74-1.58 1.78-3.03 3.07-4.26" />
                  <path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42" />
                  <path d="M1 1l22 22" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
        </div>
        <div className="flex items-start gap-2">
          <input id="terms" name="terms" checked={form.terms} onChange={onChange} type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-600" />
          <label htmlFor="terms" className="text-sm text-gray-700">Acepto los <a className="text-green-700 underline" href="#" onClick={(e)=>e.preventDefault()}>términos y condiciones</a>.</label>
        </div>
        {errors.terms && <p className="-mt-2 text-sm text-red-600">{errors.terms}</p>}
        {errors.email && errors.email.includes('registrado') && (
          <div className="mt-2 text-sm text-blue-600">
            ¿Ya tienes una cuenta?{' '}
            <a href="/login" className="text-green-600 hover:text-green-700 underline">
              Inicia sesión aquí
            </a>
          </div>
        )}
        <button disabled={submitting} type="submit" className="w-full rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white shadow transition-all hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Creando cuenta…' : 'Registrarse'}</button>
      </form>

      <div className="px-6 pb-6 md:px-8">
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center"><span className="bg-white px-3 text-sm text-gray-500">o regístrate con</span></div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            disabled={googleLoading}
            onClick={async () => {
              if (!form.terms) { setErrors((e) => ({ ...e, terms: 'Debes aceptar los términos y condiciones.' })); return }
              setGoogleLoading(true)
              try {
                await signInWithGoogle(redirectAbs)
                navigate('/dashboard', { replace: true })
              } finally {
                setGoogleLoading(false)
              }
            }}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 text-sm font-semibold text-gray-800 transition-all hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {googleLoading ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 533.5 544.3" aria-hidden="true">
                <path fill="#EA4335" d="M533.5 278.4c0-18.6-1.5-37-4.6-54.8H272v103.8h146.9c-6.3 34-25.1 62.7-53.6 82v67h86.7c50.7-46.7 81.5-115.5 81.5-198z"/>
                <path fill="#34A853" d="M272 544.3c72.6 0 133.6-24 178.1-65.7l-86.7-67c-24.1 16.2-55 25.5-91.4 25.5-70 0-129.3-47.2-150.6-110.7H31.6v69.5C75.7 492.6 167.8 544.3 272 544.3z"/>
                <path fill="#FBBC05" d="M121.4 326.4c-10.8-32.5-10.8-67.7 0-100.2v-69.5H31.6c-42.8 85.2-42.8 184 0 269.2l89.8-69.5z"/>
                <path fill="#4285F4" d="M272 107.7c39.5-.6 77.6 14.3 106.6 41.8l79.6-79.6C425.3 24.4 351.6-2.8 272 0 167.8 0 75.7 51.7 31.6 147.7l89.8 69.5C142.7 154.5 202 107.7 272 107.7z"/>
              </svg>
            )}
            <span>Google</span>
          </button>
          <button
            disabled={facebookLoading}
            onClick={async () => {
              if (!form.terms) { setErrors((e) => ({ ...e, terms: 'Debes aceptar los términos y condiciones.' })); return }
              setFacebookLoading(true)
              try {
                await signInWithFacebook(redirectAbs)
                navigate('/dashboard', { replace: true })
              } finally {
                setFacebookLoading(false)
              }
            }}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 text-sm font-semibold text-gray-800 transition-all hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {facebookLoading ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#1877F2" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.093 10.125 24v-8.438H7.078v-3.49h3.047V9.41c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.977h-1.514c-1.492 0-1.957.93-1.957 1.887v2.257h3.328l-.532 3.49h-2.796V24C19.612 23.093 24 18.1 24 12.073z"/>
              </svg>
            )}
            <span>Facebook</span>
          </button>
        </div>
      </div>
      </div>
    </main>
  )
}
