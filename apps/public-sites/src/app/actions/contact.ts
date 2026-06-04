'use server'

import { headers } from 'next/headers'
import { getResendClient, MAIL_FROM } from '@/lib/email'
import { COMPANY_INFO } from '@/lib/company-info'
import { getTenant } from '@/lib/tenant'
import { checkRateLimit } from '@/lib/contact-rate-limit'

export interface ContactFormResult {
  ok: boolean
  /** User-facing message (NL). */
  message: string
}

/**
 * Server action voor publieke contactformulier-submissions.
 * Verstuurt naar `COMPANY_INFO.centralEmail` (info@lokalebanen.nl) met
 * subject-prefix `[{Portaal}]` zodat info-team weet welk portaal de bron is.
 * Reply-to = ingevulde e-mail zodat antwoorden direct naar afzender gaan.
 *
 * Bescherming:
 * - Honeypot veld `website` (bots vullen 'm vaak in)
 * - In-memory rate-limit: 3 submissions per IP per 10 min
 * - Server-side validatie van alle velden
 */
export async function submitContactForm(formData: FormData): Promise<ContactFormResult> {
  // Honeypot
  const honeypot = formData.get('website')
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return { ok: true, message: 'Bedankt voor je bericht.' } // stille fail voor bots
  }

  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const subject = (formData.get('subject') as string | null)?.trim() ?? ''
  const message = (formData.get('message') as string | null)?.trim() ?? ''

  if (!name || !email || !message) {
    return { ok: false, message: 'Vul alstublieft alle verplichte velden in.' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'Voer een geldig e-mailadres in.' }
  }
  if (message.length > 5000) {
    return { ok: false, message: 'Bericht is te lang (max 5000 tekens).' }
  }

  // Rate-limit
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    'unknown'
  if (!checkRateLimit(ip)) {
    return {
      ok: false,
      message: 'Te veel berichten verstuurd. Probeer het later opnieuw.',
    }
  }

  const tenant = await getTenant()
  const portalName = tenant?.name ?? 'LokaleBanen-netwerk'

  try {
    const resend = getResendClient()
    const subjectPrefix = `[${portalName}]`
    const finalSubject = subject
      ? `${subjectPrefix} ${subject}`
      : `${subjectPrefix} Contactformulier`

    await resend.emails.send({
      from: MAIL_FROM,
      to: COMPANY_INFO.centralEmail,
      replyTo: email,
      subject: finalSubject,
      text: [
        `Nieuw bericht via het contactformulier op ${portalName}.`,
        '',
        `Naam:    ${name}`,
        `E-mail:  ${email}`,
        subject ? `Onderwerp: ${subject}` : null,
        '',
        '---',
        '',
        message,
      ]
        .filter((line) => line !== null)
        .join('\n'),
    })

    return {
      ok: true,
      message: 'Bedankt, je bericht is verstuurd. We nemen zo snel mogelijk contact op.',
    }
  } catch (err) {
    console.error('[contact-form] verzending mislukt:', err)
    return {
      ok: false,
      message: 'Er ging iets mis bij het versturen. Probeer het later opnieuw.',
    }
  }
}
