import { useEffect, useState } from 'react'
import { GoogleReCaptcha } from 'react-google-recaptcha-v3'

type CaptchaGateProps = {
  onChange?: (ok: boolean) => void
  onToken?: (token: string | null) => void
  action?: string
}

export default function CaptchaGate({ onChange, onToken, action = 'general' }: CaptchaGateProps) {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    onChange?.(!!token)
    onToken?.(token)
  }, [token, onChange, onToken])

  if (!siteKey) {
    return (
      <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={!!token}
          onChange={(e) => {
            const t = e.target.checked ? 'fallback-token' : null
            setToken(t)
            onToken?.(t)
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
      onVerify={(newToken) => setToken(newToken)}
    />
  )
}
