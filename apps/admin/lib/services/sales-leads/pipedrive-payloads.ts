import {
  ORG_FIELD_KEYS,
  PERSON_FIELD_KEYS,
  bedrijfsgrootteToEnum,
  customBrancheToIndustryEnum,
} from './pipedrive-fields'
import type { MasterRecord, NormalizedContact, NormalizedFields } from './types'

/**
 * Compose adres-string uit losse velden voor Pipedrive sync. Wordt gebruikt
 * als `address.full` niet gevuld is (KvK levert vaak alleen losse velden).
 */
export function composeAddressString(address: NormalizedFields['address']): string | null {
  if (!address) return null
  if (address.full && address.full.trim().length > 0) return address.full.trim()
  const line1 = [address.street, address.number].filter(Boolean).join(' ').trim()
  const line2 = [address.postcode, address.city].filter(Boolean).join(' ').trim()
  // Country alleen meenemen als er minstens een street- of postcode/city-regel is.
  // Voorkomt `[{ value: 'NL' }]` voor company records waar alleen country gevuld is.
  if (line1.length === 0 && line2.length === 0) return null
  const parts = [line1, line2, address.country].filter((s) => s && s.length > 0)
  return parts.join(', ')
}

export type OwnerConfigForSync = {
  id: string
  pipedrive_user_id: number
  pipedrive_pipeline_id: number
  pipedrive_default_stage_id: number
  hoofddomein_strategy: 'fixed' | 'auto_match_by_address'
  hoofddomein_fixed_value: string | null
  hoofddomein_fixed_option_id: number | null
  wetarget_flag_value: number
  contactmoment_field_key: string | null
  contactmoment_offset_workdays: number
}

/**
 * Bouw Pipedrive Org payload (V1).
 * Slaat alleen velden in custom_fields op die echt aanwezig zijn — voorkomt
 * dat lege strings als waarde belanden in Pipedrive.
 */
export function buildOrgPayload(
  master: MasterRecord,
  owner: OwnerConfigForSync,
  resolved: { hoofddomeinOptionId: number | null; brancheEnumId: number | null },
): {
  name: string
  owner_id: number
  visible_to: number
  address?: { value: string }
  industry?: number
  employee_count?: number
  custom_fields: Record<string, unknown>
} {
  if (!master.company_name) {
    throw new Error('company_name is verplicht voor Pipedrive Org')
  }
  const customFields: Record<string, unknown> = {}

  // KvK custom field is type 'double' in PD V2 — cast naar number, skip
  // wanneer niet-numeriek (zou een 400 geven). 8-cijferige KvK is altijd
  // safe via Number(...).
  if (master.kvk_number) {
    const num = Number(String(master.kvk_number).replace(/\D/g, ''))
    if (Number.isFinite(num)) customFields[ORG_FIELD_KEYS.KVK_NUMMER] = num
  }
  // TELEFOON custom field is type 'phone' in PD V2 — verwacht string.
  if (master.phone) customFields[ORG_FIELD_KEYS.TELEFOON] = master.phone
  if (master.email) customFields[ORG_FIELD_KEYS.EMAIL] = master.email
  if (master.website) customFields[ORG_FIELD_KEYS.WEBSITE] = master.website

  const groottE = bedrijfsgrootteToEnum(master.employee_bucket)
  if (groottE) customFields[ORG_FIELD_KEYS.BEDRIJFSGROOTTE] = groottE

  // Branche: enum_id is door PipedriveSyncService geresolved (override → suggestion → SBI-fallback
  // via BrancheOptionsService). Skip wanneer geen mapping bestaat.
  if (resolved.brancheEnumId != null) {
    customFields[ORG_FIELD_KEYS.BRANCHE] = resolved.brancheEnumId
  }

  // Hoofddomein is een enum in PD — option_id resolveerd door PipedriveSync
  // op basis van owner.hoofddomein_strategy ('fixed' → owner.option_id,
  // 'auto_match_by_address' → platforms.regio_platform lookup).
  // Skip-met-warning wanneer geen mapping — admin moet platforms-row of
  // owner-config bijwerken.
  if (resolved.hoofddomeinOptionId != null) {
    customFields[ORG_FIELD_KEYS.HOOFDDOMEIN] = resolved.hoofddomeinOptionId
  } else if (master.hoofddomein) {
    console.warn(
      `[pipedrive] Geen Hoofddomein option_id voor "${master.hoofddomein}" — set platforms.pipedrive_hoofddomein_option_id of owner.hoofddomein_fixed_option_id`,
    )
  }
  customFields[ORG_FIELD_KEYS.WETARGET_FLAG] = owner.wetarget_flag_value

  const addressString = composeAddressString(master.address)
  const industryEnumId = customBrancheToIndustryEnum(resolved.brancheEnumId)

  return {
    name: master.company_name,
    owner_id: owner.pipedrive_user_id,
    // V2 vereist visible_to als integer (V1 accepteerde string). 3 = "Entire company".
    visible_to: 3,
    // V2 organization.address is een object {value, ...}, geen array zoals persons.emails.
    // Array-format geeft success=true terug maar wordt silent genegeerd door PD.
    // composeAddressString valt terug op street/postcode/city wanneer .full ontbreekt.
    ...(addressString ? { address: { value: addressString } } : {}),
    // Standaard PD-veld 'industry' (key=industry) naast custom Branche-veld (5a46...).
    // Mapping van 12 custom opties naar de 20 standaard PD industry-opties.
    ...(industryEnumId != null ? { industry: industryEnumId } : {}),
    // Standaard PD-veld 'employee_count' (int) naast custom Bedrijfsgrootte-enum (klein/middel/groot).
    ...(typeof master.employee_count === 'number' && Number.isFinite(master.employee_count)
      ? { employee_count: master.employee_count }
      : {}),
    custom_fields: customFields,
  }
}

/**
 * Bouw Pipedrive Person payload (V1; client converteert email→emails voor V2-create).
 *
 * Email-fallback: bij contact zonder email, `companyDomain` levert info@{domain}.
 * Phone-fallback: 3-tier — contact.phone_mobile → contact.phone_other → `companyPhone`
 * (master.phone, het bedrijfsnummer). Zo komt er altijd een telefoon mee als die
 * voor het bedrijf bekend is, ook al heeft het contact zelf er geen.
 */
export function buildPersonPayload(
  contact: NormalizedContact,
  orgId: number,
  owner: OwnerConfigForSync,
  opts?: { companyDomain?: string | null; companyPhone?: string | null },
): {
  name: string
  org_id: number
  owner_id: number
  visible_to: number
  email?: Array<{ value: string; primary: boolean }>
  phone?: Array<{ value: string; primary: boolean }>
} & Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: contact.name,
    org_id: orgId,
    owner_id: owner.pipedrive_user_id,
    visible_to: 3,
  }
  const email = contact.email ?? (opts?.companyDomain ? `info@${opts.companyDomain}` : null)
  if (email) out.email = [{ value: email, primary: true }]
  const phone = contact.phone_mobile ?? contact.phone_other ?? opts?.companyPhone ?? null
  if (phone) out.phone = [{ value: phone, primary: true }]
  if (contact.title) out[PERSON_FIELD_KEYS.FUNCTIE] = contact.title
  if (contact.linkedin_url) out[PERSON_FIELD_KEYS.LINKEDIN] = contact.linkedin_url
  return out as ReturnType<typeof buildPersonPayload>
}

/**
 * Bouw Pipedrive Deal payload (V2 — `custom_fields` object).
 */
export function buildDealPayload(
  master: MasterRecord,
  orgId: number,
  primaryPersonId: number | undefined,
  owner: OwnerConfigForSync,
  contactmomentDate: string,
): {
  title: string
  owner_id: number
  person_id?: number
  org_id: number
  pipeline_id: number
  stage_id: number
  value: number
  currency: string
  visible_to: number
  custom_fields: Record<string, string>
} {
  const today = new Date().toISOString().split('T')[0]
  const customFields: Record<string, string> = {}
  if (owner.contactmoment_field_key) {
    customFields[owner.contactmoment_field_key] = contactmomentDate
  }
  return {
    title: `${master.company_name ?? '(naam onbekend)'} - ${today}`,
    owner_id: owner.pipedrive_user_id,
    ...(primaryPersonId ? { person_id: primaryPersonId } : {}),
    org_id: orgId,
    pipeline_id: owner.pipedrive_pipeline_id,
    stage_id: owner.pipedrive_default_stage_id,
    value: 0,
    currency: 'EUR',
    visible_to: 3,
    custom_fields: customFields,
  }
}

/**
 * Geef YYYY-MM-DD van `from` + `offset_workdays` werkdagen (skipt zat/zon).
 * Werkt op UTC-getDay; voor NL werkdag-resolutie acceptabel (geen tz-edge cases
 * binnen kantooruren).
 */
export function nextWorkday(from: Date, offsetWorkdays: number): string {
  const d = new Date(from)
  let added = 0
  while (added < offsetWorkdays) {
    d.setUTCDate(d.getUTCDate() + 1)
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) added++
  }
  return d.toISOString().split('T')[0]
}
