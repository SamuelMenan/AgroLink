import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import CaptchaGate from '../components/CaptchaGate'
import { getOAuthStartUrl } from '../services/apiAuth'

export default function Login() {
  const { signInWithCredentials /*, signInWithGoogle, signInWithFacebook */ } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('') // correo o teléfono
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [facebookLoading, setFacebookLoading] = useState(false)
  const [remember, setRemember] = useState(true)
  const [captchaOk, setCaptchaOk] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)

  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const nextParam = params.get('next') || '/simple'
  const intent = params.get('intent')
  const messagingRedirect = intent === 'messaging'

  // URL absoluta a donde queremos ir después de login
  const redirectAbs = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const path = nextParam.startsWith('/') ? nextParam : '/simple'
    return `${origin}${path}`
  }, [nextParam])

  const onIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/^\s+/, '')
    setIdentifier(v)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!identifier.trim() || !password) {
      setFormError('Ingresa tu correo/teléfono y contraseña.')
      return
    }
    // si hay sitekey configurado, requiere captcha
    if (import.meta.env.VITE_HCAPTCHA_SITEKEY && !captchaOk) {
      setFormError('Completa la verificación de seguridad.')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await signInWithCredentials({ identifier: identifier.trim(), password, captchaToken: captchaToken || undefined })
      if (error) {
        setFormError(error)
        return
      }
      // Persistencia: se guarda preferencia (placeholder UI). Implementación avanzada: custom storage por sesión.
      localStorage.setItem('agrolink_remember', remember ? '1' : '0')
      
      // Check if there's a redirect URL stored (from messaging or other protected actions)
      const redirectAfterLogin = localStorage.getItem('redirect_after_login')
      if (redirectAfterLogin) {
        localStorage.removeItem('redirect_after_login')
        window.location.href = redirectAfterLogin
      } else {
        navigate(nextParam || '/simple', { replace: true })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-lg">
        <div className="border-b border-gray-100 p-6 md:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-green-800">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-gray-600">Accede a tu panel y continúa con tus operaciones.</p>
        </div>
        {intent === 'publish' && (
          <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Inicia sesión para publicar tu producto. Te llevaremos a la página de publicación al entrar.
          </div>
        )}
        {messagingRedirect && (
          <div className="mx-6 mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
            Necesitas iniciar sesión para enviar mensajes. Por favor, autentícate para continuar.
          </div>
        )}
        <form onSubmit={onSubmit} className="p-6 md:p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">Correo electrónico o teléfono</label>
            <input
              value={identifier}
              onChange={onIdentifierChange}
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
              placeholder="tu@email.com o 3001234567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPwd ? 'text' : 'password'}
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
            <CaptchaGate onChange={setCaptchaOk} onToken={setCaptchaToken} />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-600"
              />
              Recordar sesión
            </label>
            <a
              className="text-sm font-medium text-green-700 hover:text-green-800 hover:underline"
              href="/forgot-password"
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button
            disabled={submitting || (!!import.meta.env.VITE_HCAPTCHA_SITEKEY && !captchaOk)}
            type="submit"
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white shadow transition-all hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="px-6 pb-6 md:px-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-sm text-gray-500">o continúa con</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              disabled={googleLoading}
              onClick={async () => {
                setGoogleLoading(true)
                try {
                  // Redirigir directamente al backend OAuth start
                  const url = getOAuthStartUrl('google', redirectAbs)
                  window.location.href = url
                } finally {
                  setGoogleLoading(false)
                }
              }}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 text-sm font-semibold text-gray-800 transition-all hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {googleLoading ? (
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  ></path>
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 533.5 544.3"
                  aria-hidden="true"
                >
                  <path
                    fill="#EA4335"
                    d="M533.5 278.4c0-18.6-1.5-37-4.6-54.8H272v103.8h146.9c-6.3 34-25.1 62.7-53.6 82v67h86.7c50.7-46.7 81.5-115.5 81.5-198z"
                  />
                  <path
                    fill="#34A853"
                    d="M272 544.3c72.6 0 133.6-24 178.1-65.7l-86.7-67c-24.1 16.2-55 25.5-91.4 25.5-70 0-129.3-47.2-150.6-110.7H31.6v69.5C75.7 492.6 167.8 544.3 272 544.3z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M121.4 326.4c-10.8-32.5-10.8-67.7 0-100.2v-69.5H31.6c-42.8 85.2-42.8 184 0 269.2l89.8-69.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M272 107.7c39.5-.6 77.6 14.3 106.6 41.8l79.6-79.6C425.3 24.4 351.6-2.8 272 0 167.8 0 75.7 51.7 31.6 147.7l89.8 69.5C142.7 154.5 202 107.7 272 107.7z"
                  />
                </svg>
              )}
              <span>Google</span>
            </button>
            <button
              disabled={facebookLoading}
              onClick={async () => {
                setFacebookLoading(true)
                try {
                  const url = getOAuthStartUrl('facebook', redirectAbs)
                  window.location.href = url
                } finally {
                  setFacebookLoading(false)
                }
              }}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 text-sm font-semibold text-gray-800 transition-all hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {facebookLoading ? (
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  ></path>
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#1877F2"
                    d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.093 10.125 24v-8.438H7.078v-3.49h3.047V9.41c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.977h-1.514c-1.492 0-1.957.93-1.957 1.887v2.257h3.328l-.532 3.49h-2.796V24C19.612 23.093 24 18.1 24 12.073z"
                  />
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
