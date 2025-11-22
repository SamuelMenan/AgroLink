import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Register() {
  const { signUpWithEmail } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const [pwdReq, setPwdReq] = useState({ len:false, upper:false, num:false, special:false })
  const [pwdStrength, setPwdStrength] = useState(0)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const fn = firstName.trim()
    const ln = lastName.trim()
    // Validación nombres: solo letras (incluye tildes y ñ), sin espacios/guiones/apóstrofes, 1–100
    const nameRegex = /^\p{L}{1,100}$/u
    if (!nameRegex.test(fn) || !nameRegex.test(ln)) { setNameError('Usa solo letras, 1–100 caracteres (sin espacios, guiones o apóstrofes)'); return }
    const em = email.trim().toLowerCase()
    const isEmailValid = !em || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)
    if (!isEmailValid) { setEmailError('Correo inválido, usa formato user@domain.com'); return }
    if (!em) { setFormError('Ingresa tu correo electrónico'); return }
    if (!password) { setFormError('Ingresa una contraseña'); return }
    setSubmitting(true)
    try {
      const fullName = `${fn} ${ln}`
      const { error } = await signUpWithEmail({ fullName, email: em, password })
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
            <label className="block text-sm font-medium text-gray-700">Correo electrónico</label>
            <input value={email} onChange={(e) => { const v=e.target.value.replace(/^\s+/, ''); setEmail(v); setEmailError(v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Correo inválido, usa formato user@domain.com' : null) }} type="email" className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
            {emailError && <p className="text-sm text-red-600 transition-opacity duration-300 ease-in-out">{emailError}</p>}
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
      </div>
    </main>
  )
}

