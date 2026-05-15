import {
  ORG_FIELD_KEYS,
  PERSON_FIELD_KEYS,
  bedrijfsgrootteToEnum,
} from './pipedrive-fields'
import { sbiToBrancheEnumId } from '@/lib/constants/sbi-mapping'
import type { MasterRecord, NormalizedContact } from './types'

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
  resolved: { hoofddomeinOptionId: number | null },
): {
  name: string
  owner_id: number
  visible_to: number
  address?: string
  custom_fields: Record<string, unknown>
} {
  if (!master.company_name) {
    throw new Error('company_name is verplicht voor Pipedrive Org')
  }
  const customFields: Record<string, unknown> = {}

  if (master.kvk_number) customFields[ORG_FIELD_KEYS.KVK_NUMMER] = master.kvk_number
  if (master.phone) customFields[ORG_FIELD_KEYS.TELEFOON] = master.phone
  if (master.email) customFields[ORG_FIELD_KEYS.EMAIL] = master.email
  if (master.website) customFields[ORG_FIELD_KEYS.WEBSITE] = master.website

  const groottE = bedrijfsgrootteToEnum(master.employee_bucket)
  if (groottE) customFields[ORG_FIELD_KEYS.BEDRIJFSGROOTTE] = groottE

  // Branche: probeer eerste industry_code (SBI) → enum-mapping. Skip bij geen mapping.
  const firstSbi = master.industry_codes?.[0]
  const branche = sbiToBrancheEnumId(firstSbi)
  if (branche) customFields[ORG_FIELD_KEYS.BRANCHE] = branche

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

  return {
    name: master.company_name,
    owner_id: owner.pipedrive_user_id,
    // V2 vereist visible_to als integer (V1 accepteerde string). 3 = "Entire company".
    visible_to: 3,
    ...(master.address?.full ? { address: master.address.full } : {}),
    custom_fields: customFields,
  }
}

/**
 * Bouw Pipedrive Person payload (V1; client converteert email→emails voor V2-create).
 */
export function buildPersonPayload(
  contact: NormalizedContact,
  orgId: number,
  owner: OwnerConfigForSync,
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
  if (contact.email) out.email = [{ value: contact.email, primary: true }]
  const phone = contact.phone_mobile ?? contact.phone_other
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
    title: `${master.company_name ?? '(naam onbekend)'} — ${today}`,
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
