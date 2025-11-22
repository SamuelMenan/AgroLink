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
    useEffect(() => {
      onChange?.(true)
      onToken?.(null)
    }, [onChange, onToken])
    return null
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
  const forceDisable = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_RECAPTCHA_FORCE_DISABLE === 'true'

  if (!siteKey || forceDisable) {
    return <CaptchaContent onChange={onChange} onToken={onToken} action={action} />
  }

  return (
    <GoogleReCaptchaProvider reCaptchaKey={siteKey}>
      <CaptchaContent onChange={onChange} onToken={onToken} action={action} />
    </GoogleReCaptchaProvider>
  )
}
