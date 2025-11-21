import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestPhoneRecoveryToken, verifyPhoneRecoveryToken, resetPasswordWithPhone } from '../services/apiAuth'

export default function PhoneRecovery() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'phone' | 'verify' | 'newPassword'>('phone')
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    
    if (!phone.trim()) {
      setError('Ingresa tu número de teléfono.')
      return
    }
    
    // Validar formato de teléfono
    const phoneRegex = /^\+?\d{7,15}$/
    if (!phoneRegex.test(phone.replace(/\s|-/g, ''))) {
      setError('Ingresa un número de teléfono válido.')
      return
    }
    
    setSubmitting(true)
    try {
      await requestPhoneRecoveryToken(phone.trim())
      setSuccess('Se ha enviado un código de verificación a tu teléfono.')
      setStep('verify')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al enviar el código'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleTokenVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    
    if (!token.trim()) {
      setError('Ingresa el código de verificación.')
      return
    }
    
    if (token.length < 4) {
      setError('El código debe tener al menos 4 dígitos.')
      return
    }
    
    setSubmitting(true)
    try {
      await verifyPhoneRecoveryToken(phone, token)
      setStep('newPassword')
      setSuccess('Código verificado correctamente.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Código inválido o expirado'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    
    if (!newPassword.trim()) {
      setError('Ingresa una nueva contraseña.')
      return
    }
    
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    
    setSubmitting(true)
    try {
      await resetPasswordWithPhone(phone, token, newPassword)
      setSuccess('Contraseña restablecida correctamente. Redirigiendo...')
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al restablecer la contraseña'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const renderPhoneStep = () => (
    <form onSubmit={handlePhoneSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Número de teléfono</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
          placeholder="+573001234567"
        />
        <p className="mt-1 text-xs text-gray-500">Ingresa tu número de teléfono registrado</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}
      <button
        disabled={submitting}
        type="submit"
        className="w-full rounded-md bg-green-600 px-4 py-2.5 font-medium text-white shadow hover:bg-green-700 disabled:opacity-60"
      >
        {submitting ? 'Enviando código...' : 'Enviar código SMS'}
      </button>
    </form>
  )

  const renderVerifyStep = () => (
    <form onSubmit={handleTokenVerify} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Código de verificación</label>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
          placeholder="123456"
        />
        <p className="mt-1 text-xs text-gray-500">Ingresa el código de 6 dígitos enviado a {phone}</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}
      <button
        disabled={submitting}
        type="submit"
        className="w-full rounded-md bg-green-600 px-4 py-2.5 font-medium text-white shadow hover:bg-green-700 disabled:opacity-60"
      >
        {submitting ? 'Verificando...' : 'Verificar código'}
      </button>
      <button
        type="button"
        onClick={() => setStep('phone')}
        className="w-full text-sm text-green-700 hover:text-green-800"
      >
        ¿No recibiste el código? Reenviar
      </button>
    </form>
  )

  const renderNewPasswordStep = () => (
    <form onSubmit={handlePasswordReset} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Nueva contraseña</label>
        <div className="relative">
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            type={showPassword ? 'text' : 'password'}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 pr-10 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
          >
            {showPassword ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.74-1.58 1.78-3.03 3.07-4.26" />
                <path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42" />
                <path d="M1 1l22 22" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Confirmar contraseña</label>
        <div className="relative">
          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type={showConfirmPassword ? 'text' : 'password'}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 pr-10 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
          >
            {showConfirmPassword ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.74-1.58 1.78-3.03 3.07-4.26" />
                <path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42" />
                <path d="M1 1l22 22" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}
      <button
        disabled={submitting}
        type="submit"
        className="w-full rounded-md bg-green-600 px-4 py-2.5 font-medium text-white shadow hover:bg-green-700 disabled:opacity-60"
      >
        {submitting ? 'Restableciendo...' : 'Restablecer contraseña'}
      </button>
    </form>
  )

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-lg">
        <div className="border-b border-gray-100 p-6 md:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-green-800">
            Recuperar contraseña por SMS
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {step === 'phone' && 'Ingresa tu número de teléfono para recibir un código de verificación'}
            {step === 'verify' && 'Ingresa el código que recibiste por SMS'}
            {step === 'newPassword' && 'Crea una nueva contraseña para tu cuenta'}
          </p>
        </div>
        
        <div className="p-6 md:p-8">
          {/* Progress indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step === 'phone' ? 'bg-green-600 text-white' : 
                step === 'verify' || step === 'newPassword' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}>
                1
              </div>
              <div className={`flex-1 h-1 mx-2 ${
                step === 'verify' || step === 'newPassword' ? 'bg-green-600' : 'bg-gray-200'
              }`} />
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step === 'verify' ? 'bg-green-600 text-white' : 
                step === 'newPassword' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}>
                2
              </div>
              <div className={`flex-1 h-1 mx-2 ${
                step === 'newPassword' ? 'bg-green-600' : 'bg-gray-200'
              }`} />
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step === 'newPassword' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                3
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Teléfono</span>
              <span>Verificar</span>
              <span>Nueva contraseña</span>
            </div>
          </div>

          {step === 'phone' && renderPhoneStep()}
          {step === 'verify' && renderVerifyStep()}
          {step === 'newPassword' && renderNewPasswordStep()}
        </div>

        <div className="border-t border-gray-100 px-6 py-4 md:px-8">
          <p className="text-center text-sm text-gray-600">
            ¿Prefieres recuperar por correo?{' '}
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-green-700 hover:text-green-800 font-medium"
            >
              Usar correo electrónico
            </button>
          </p>
        </div>
      </div>
    </main>
  )
}