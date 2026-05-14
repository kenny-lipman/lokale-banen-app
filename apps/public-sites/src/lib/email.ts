import { Resend } from 'resend'

/**
 * Lazy Resend client — instantieert pas bij eerste gebruik zodat builds
 * zonder RESEND_API_KEY niet falen. Calls die geen key hebben → throw.
 * Op de public-sites wordt dit alleen aangeroepen vanuit server-actions
 * voor contactformulier-submissions naar info@lokalebanen.nl.
 */
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

export const MAIL_FROM = process.env.RESEND_FROM ?? 'noreply@cas.works'
