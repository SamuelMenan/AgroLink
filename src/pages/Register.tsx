import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Register() {
  const { signUpWithEmail, signInWithGoogle, signInWithFacebook } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const [pwdReq, setPwdReq] = useState({ len:false, upper:false, num:false, special:false })
  const [pwdStrength, setPwdStrength] = useState(0)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const fn = firstName.trim()
    const ln = lastName.trim()
    if (fn.length < 2 || ln.length < 2) { setNameError('Nombre y apellido deben tener al menos 2 caracteres'); return }
    const em = email.trim()
    const isEmailValid = !em || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)
    if (!isEmailValid) { setEmailError('Correo inválido, usa formato user@domain.com'); return }
    const digits = phone.replace(/\D/g,'')
    if (digits && digits.length !== 10) { setPhoneError('El teléfono debe tener exactamente 10 dígitos'); return }
    if (!em && !digits) { setFormError('Ingresa correo o teléfono'); return }
    if (!password) { setFormError('Ingresa una contraseña'); return }
    setSubmitting(true)
    try {
      const fullName = `${fn} ${ln}`
      const { error } = await signUpWithEmail({ fullName, email: em, password, phone: digits || undefined })
      if (error) {
        setFormError(error)
        return
      }
      setFormError(null)
      navigate('/simple', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-lg">
        <div className="border-b border-gray-100 p-6 md:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-green-800">Crear cuenta</h1>
          <p className="mt-1 text-sm text-gray-600">Regístrate para continuar.</p>
        </div>
        <form onSubmit={onSubmit} className="p-6 md:p-8 space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre</label>
              <input value={firstName} onChange={(e)=>{ setFirstName(e.target.value.replace(/^\s+/, '')); setNameError(null) }} type="text" className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Apellido</label>
              <input value={lastName} onChange={(e)=>{ setLastName(e.target.value.replace(/^\s+/, '')); setNameError(null) }} type="text" className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
            </div>
          </div>
          {nameError && <p className="text-sm text-red-600 transition-opacity duration-300 ease-in-out">{nameError}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700">Correo electrónico (opcional)</label>
            <input value={email} onChange={(e) => { const v=e.target.value.replace(/^\s+/, ''); setEmail(v); setEmailError(v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Correo inválido, usa formato user@domain.com' : null) }} type="email" className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
            {emailError && <p className="text-sm text-red-600 transition-opacity duration-300 ease-in-out">{emailError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Teléfono (opcional)</label>
            <input value={formatPhone(phone)} onChange={(e) => { const digits=e.target.value.replace(/\D/g,'').slice(0,10); setPhone(digits); setPhoneError(digits && digits.length!==10 ? 'El teléfono debe tener exactamente 10 dígitos' : null) }} inputMode="numeric" type="tel" className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" placeholder="(___) ___-____" />
            {phoneError && <p className="text-sm text-red-600 transition-opacity duration-300 ease-in-out">{phoneError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <div className="relative">
              <input value={password} onChange={(e)=>{ const v=e.target.value; setPassword(v); const req={ len:v.length>=8, upper:/[A-Z]/.test(v), num:/[0-9]/.test(v), special:/[^A-Za-z0-9]/.test(v) }; setPwdReq(req); const s=[req.len,req.upper,req.num,req.special].reduce((a,b)=>a+(b?1:0),0); setPwdStrength(s) }} type={showPwd ? 'text' : 'password'} className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 pr-10 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
              <button type="button" aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPwd(v => !v)} className="absolute inset-y-0 right-2 mt-1 flex items-center text-gray-500 hover:text-gray-700">
                {showPwd ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.74-1.58 1.78-3.03 3.07-4.26" /><path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42" /><path d="M1 1l22 22" /></svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
            <div className="mt-2">
              <div className="h-2 rounded bg-gray-200 overflow-hidden">
                <div className={`h-2 transition-all duration-300 ease-in-out ${pwdStrength<=1?'bg-red-500':pwdStrength===2?'bg-yellow-500':pwdStrength===3?'bg-green-500':'bg-emerald-600'}`} style={{ width: `${(pwdStrength/4)*100}%` }}></div>
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <li className={`flex items-center gap-1 ${pwdReq.len?'text-green-700':'text-gray-600'}`}><span className="material-icons-outlined text-base">{pwdReq.len?'check_circle':'radio_button_unchecked'}</span><span>8+ caracteres</span></li>
                <li className={`flex items-center gap-1 ${pwdReq.upper?'text-green-700':'text-gray-600'}`}><span className="material-icons-outlined text-base">{pwdReq.upper?'check_circle':'radio_button_unchecked'}</span><span>1 mayúscula</span></li>
                <li className={`flex items-center gap-1 ${pwdReq.num?'text-green-700':'text-gray-600'}`}><span className="material-icons-outlined text-base">{pwdReq.num?'check_circle':'radio_button_unchecked'}</span><span>1 número</span></li>
                <li className={`flex items-center gap-1 ${pwdReq.special?'text-green-700':'text-gray-600'}`}><span className="material-icons-outlined text-base">{pwdReq.special?'check_circle':'radio_button_unchecked'}</span><span>1 especial</span></li>
              </ul>
            </div>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button disabled={submitting} type="submit" className="w-full rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white shadow transition-all hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Creando…' : 'Crear cuenta'}
          </button>
        </form>
        <div className="px-6 pb-6 md:px-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-sm text-gray-500">o regístrate con</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button onClick={async () => { await signInWithGoogle('/simple') }} className="flex items-center justify-center gap-2 rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 text-sm font-semibold text-gray-800 transition-all hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">
              <svg className="h-4 w-4" viewBox="0 0 533.5 544.3" aria-hidden="true"><path fill="#EA4335" d="M533.5 278.4c0-18.6-1.5-37-4.6-54.8H272v103.8h146.9c-6.3 34-25.1 62.7-53.6 82v67h86.7c50.7-46.7 81.5-115.5 81.5-198z" /><path fill="#34A853" d="M272 544.3c72.6 0 133.6-24 178.1-65.7l-86.7-67c-24.1 16.2-55 25.5-91.4 25.5-70 0-129.3-47.2-150.6-110.7H31.6v69.5C75.7 492.6 167.8 544.3 272 544.3z" /><path fill="#FBBC05" d="M121.4 326.4c-10.8-32.5-10.8-67.7 0-100.2v-69.5H31.6c-42.8 85.2-42.8 184 0 269.2l89.8-69.5z" /><path fill="#4285F4" d="M272 107.7c39.5-.6 77.6 14.3 106.6 41.8l79.6-79.6C425.3 24.4 351.6-2.8 272 0 167.8 0 75.7 51.7 31.6 147.7l89.8 69.5C142.7 154.5 202 107.7 272 107.7z" /></svg>
              <span>Google</span>
            </button>
            <button onClick={async () => { await signInWithFacebook('/simple') }} className="flex items-center justify-center gap-2 rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 text-sm font-semibold text-gray-800 transition-all hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.093 10.125 24v-8.438H7.078v-3.49h3.047V9.41c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.977h-1.514c-1.492 0-1.957.93-1.957 1.887v2.257h3.328l-.532 3.49h-2.796V24C19.612 23.093 24 18.1 24 12.073z" /></svg>
              <span>Facebook</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

function formatPhone(d: string) {
  const s = d.replace(/\D/g,'').slice(0,10)
  const p1 = s.slice(0,3)
  const p2 = s.slice(3,6)
  const p3 = s.slice(6,10)
  if (s.length <= 3) return `(${p1}`
  if (s.length <= 6) return `(${p1}) ${p2}`
  return `(${p1}) ${p2}-${p3}`
}

