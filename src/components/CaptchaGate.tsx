import { useEffect, useState } from 'react'
import { GoogleReCaptchaProvider, GoogleReCaptcha } from 'react-google-recaptcha-v3'

interface CaptchaGateProps {
  onChange?: (ok: boolean) => void
  onToken?: (token: string | null) => void
  action?: string
}

function CaptchaContent({ onChange, onToken, action = 'login' }: CaptchaGateProps) {
  const [token, setToken] = useState<string | null>(null)
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined

  useEffect(() => {
    onChange?.(!!token)
    onToken?.(token)
  }, [token, onChange, onToken])

  if (!siteKey) {
    // Fallback simple cuando no hay sitekey configurado
    return (
      <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
        <input 
          type="checkbox" 
          checked={!!token} 
          onChange={(e) => { 
            setToken(e.target.checked ? 'fallback-token' : null)
            onToken?.(e.target.checked ? 'fallback-token' : null)
          }} 
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-600" 
        />
        <span>No soy un robot</span>
      </label>
    )
  }

  return (
    <GoogleReCaptcha 
      action={action}
      onVerify={(newToken) => {
        setToken(newToken)
      }}
    />
  )
}

export default function CaptchaGate({ onChange, onToken, action = 'login' }: CaptchaGateProps) {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined

  if (!siteKey) {
    return <CaptchaContent onChange={onChange} onToken={onToken} action={action} />
  }

  return (
    <GoogleReCaptchaProvider reCaptchaKey={siteKey}>
      <CaptchaContent onChange={onChange} onToken={onToken} action={action} />
    </GoogleReCaptchaProvider>
  )
}