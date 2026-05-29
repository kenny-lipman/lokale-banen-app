import { extractApex } from '@/lib/utils/url'
import type { MasterRecord, NormalizedContact } from './types'

const SYNTHETIC_NAME = 'Afdeling Personeelszaken'

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

// 06 / +316 / 00316 = NL mobiel-prefix. Aansluiting op de detectie in
// website.service.ts:mapToNormalized zodat synthetic-contact dezelfde
// phone-typing volgt als andere bronnen.
function isDutchMobile(phone: string): boolean {
  return /^(\+?316|00316|06)/.test(phone.replace(/\s+/g, ''))
}

/**
 * Bouw het synthetic "Afdeling Personeelszaken"-contact wanneer er nog geen
 * Personeelszaken-record in de huidige contact-lijst zit en master een email
 * of telefoon levert. Returnt `null` wanneer:
 *  - er al een Personeelszaken-record bestaat (Mistral website-fallback wint).
 *  - er noch email noch phone beschikbaar is (contact zou geen waarde hebben).
 *
 * Pure functie zonder side-effects of DB-calls; veilig om te unit-testen.
 */
export function buildSyntheticPersoneelszaken(
  master: Pick<MasterRecord, 'email' | 'phone'>,
  inputDomain: string | null | undefined,
  existing: ReadonlyArray<NormalizedContact>,
): NormalizedContact | null {
  const targetNorm = normalizeName(SYNTHETIC_NAME)
  if (existing.some((c) => normalizeName(c.name) === targetNorm)) {
    return null
  }

  const apex = inputDomain ? extractApex(inputDomain) : null
  const email = master.email ?? (apex ? `info@${apex}` : undefined)
  const phone = master.phone ?? undefined
  if (!email && !phone) return null

  return {
    name: SYNTHETIC_NAME,
    first_name: SYNTHETIC_NAME,
    last_name: '',
    title: undefined,
    email,
    phone_mobile: phone && isDutchMobile(phone) ? phone : undefined,
    phone_other: phone && !isDutchMobile(phone) ? phone : undefined,
    department: 'human_resources',
    source_origin: ['synthetic'],
    ai_priority_score: 10,
    ai_priority_reason: 'Synthetic fallback - bedrijfsemail en telefoon',
  }
}
