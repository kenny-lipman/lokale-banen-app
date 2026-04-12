import { Resend } from 'resend'

// Lazy singleton (avoids module-level env var validation during build)
let _resend: Resend | null = null
export function getResendClient(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is required')
    }
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

/** @deprecated Use getResendClient() instead */
export const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    return (getResendClient() as Record<string | symbol, unknown>)[prop]
  }
})
