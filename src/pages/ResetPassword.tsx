import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!password || password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setSubmitting(true)
    try {
      const { error } = await updatePassword(password)
      if (error) { setError(error); return }
      navigate('/dashboard', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold text-green-800">Restablecer contraseña</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nueva contraseña</label>
          <input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Confirmar contraseña</label>
          <input value={confirm} onChange={(e)=>setConfirm(e.target.value)} type="password" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={submitting} type="submit" className="w-full rounded-md bg-green-600 px-4 py-2.5 font-medium text-white shadow hover:bg-green-700 disabled:opacity-60">{submitting ? 'Actualizando…' : 'Actualizar contraseña'}</button>
      </form>
    </main>
  )
}
