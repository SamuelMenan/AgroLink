import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null); setError(null)
    if (!email.trim()) { setError('Ingresa tu correo.'); return }
    setSubmitting(true)
    try {
      const { error } = await resetPassword(email.trim())
      if (error) { setError(error); return }
      setMsg('Si tu correo está registrado, te enviamos un enlace para restablecer la contraseña.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold text-green-800">Recuperar contraseña</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Correo electrónico</label>
          <input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {msg && <p className="text-sm text-green-700">{msg}</p>}
        <button disabled={submitting} type="submit" className="w-full rounded-md bg-green-600 px-4 py-2.5 font-medium text-white shadow hover:bg-green-700 disabled:opacity-60">{submitting ? 'Enviando…' : 'Enviar enlace'}</button>
      </form>
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          ¿Prefieres recuperar por SMS?{' '}
          <button
            type="button"
            onClick={() => navigate('/phone-recovery')}
            className="text-green-700 hover:text-green-800 font-medium"
          >
            Usar número de teléfono
          </button>
        </p>
      </div>
    </main>
  )
}
