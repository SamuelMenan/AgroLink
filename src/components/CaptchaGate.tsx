import { useEffect, useState } from 'react'
import HCaptcha from '@hcaptcha/react-hcaptcha'

type Props = {
  onChange?: (ok: boolean) => void
}

export default function CaptchaGate({ onChange }: Props) {
  const sitekey = import.meta.env.VITE_HCAPTCHA_SITEKEY as string | undefined
  const [solved, setSolved] = useState(false)

  useEffect(() => {
    onChange?.(solved)
  }, [solved, onChange])

  if (!sitekey) {
    // Fallback simple cuando no hay sitekey configurado
    return (
      <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={solved} onChange={(e) => setSolved(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-600" />
        <span>No soy un robot</span>
      </label>
    )
  }

  return (
    <div className="mt-2">
      <HCaptcha sitekey={sitekey} onVerify={() => setSolved(true)} onExpire={() => setSolved(false)} onError={() => setSolved(false)} />
    </div>
  )
}
