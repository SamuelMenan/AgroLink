import { useEffect, useState } from 'react'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import ReCAPTCHA from 'react-google-recaptcha'

type Props = {
  onChange?: (ok: boolean) => void
  onToken?: (token: string | null) => void
}

export default function CaptchaGate({ onChange, onToken }: Props) {
  const hSitekey = import.meta.env.VITE_HCAPTCHA_SITEKEY as string | undefined
  const gSitekey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined
  const [solved, setSolved] = useState(false)

  useEffect(() => {
    onChange?.(solved)
  }, [solved, onChange])

  if (!hSitekey && !gSitekey) {
    // Fallback simple cuando no hay sitekey configurado
    return (
      <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={solved} onChange={(e) => { setSolved(e.target.checked); onToken?.(null) }} className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-600" />
        <span>No soy un robot</span>
      </label>
    )
  }

  return (
    <div className="mt-2">
      {gSitekey ? (
        <ReCAPTCHA sitekey={gSitekey} onChange={(token) => { setSolved(!!token); onToken?.(token || null) }} onExpired={() => { setSolved(false); onToken?.(null) }} />
      ) : (
        <HCaptcha sitekey={hSitekey!} onVerify={(token) => { setSolved(true); onToken?.(token) }} onExpire={() => { setSolved(false); onToken?.(null) }} onError={() => { setSolved(false); onToken?.(null) }} />
      )}
    </div>
  )
}
