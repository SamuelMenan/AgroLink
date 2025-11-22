import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { signUpWithEmail } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!fullName.trim() || (!email.trim() && !phone.trim()) || !password) {
      setFormError('Completa nombre y correo o teléfono, y una contraseña.')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await signUpWithEmail({ fullName: fullName.trim(), email: email.trim(), password, phone: phone.trim() || undefined })
      if (error) {
        setFormError(error)
        return
      }
      setFormError(null)
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
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre completo</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} type="text" className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Correo electrónico (opcional)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Teléfono (opcional)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="mt-1 w-full rounded-lg border border-gray-300/90 bg-white/80 px-3 py-2 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
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

