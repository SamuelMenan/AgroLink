declare module 'react-google-recaptcha' {
  import * as React from 'react'
  export type Size = 'compact' | 'normal' | 'invisible'
  export type Theme = 'light' | 'dark'
  export interface ReCAPTCHAProps {
    sitekey: string
    onChange?: (token: string | null) => void
    onExpired?: () => void
    onErrored?: () => void
    size?: Size
    theme?: Theme
    tabindex?: number
    hl?: string
  }
  const ReCAPTCHA: React.ComponentType<ReCAPTCHAProps>
  export default ReCAPTCHA
}