/**
 * Centrale Pipedrive custom field keys + enum-mappings voor sales-lead sync.
 *
 * Field-hashes zijn 40-char SHA-prefixes; spec gebruikt 8-char shortcuts.
 * Geverifieerd via scripts/print-pipedrive-fields.mjs (Task 0).
 */

// ── Organization custom fields ─────────────────────────────────────────────
export const ORG_FIELD_KEYS = {
  // matched against name="KvK-nummer"
  KVK_NUMMER: '1e887677c33f2cd084eb85a4bf421b657e7ba154',
  // matched against name="Telefoonnummer" (geen aparte "Telefoon hoofdvestiging" in tenant)
  TELEFOON: 'f249147e63f82da820824528364fe2cc8fb86482',
  // matched against name="E-mailadres"
  EMAIL: '4811ae7e384a95197ebc7224ba0b5a9cc9bc4de2',
  // matched against name="Website"
  WEBSITE: '79f6688e77fed7099077425e7f956d52aaa9defb',
  // matched against name="Bedrijfsgrootte"
  BEDRIJFSGROOTTE: 'f68e60517a23efa9a0d9defa762c534bb7cbfc46',
  // matched against name="Branche" (enum opts 53=Automotive, 54=Bouw, 55=Detailhandel, 56=Horeca…)
  // NB: er bestaat een tweede "Branche"-veld (5a467ae0…) met andere enum-ids (286+);
  // sbi-mapping.ts gebruikt deze (53/54/55/56-reeks) als bron.
  BRANCHE: '75a7b46357970b58a7c5f9763ddcd23a5806e108',
  // matched against name="Hoofddomein" (verified met pipedrive-client.ts:22)
  HOOFDDOMEIN: '7180a7123d1de658e8d1d642b8496802002ddc66',
  // matched against name="WeTarget" (opts 265=WeTarget, 301=Nee)
  WETARGET_FLAG: 'a92798b0ef9f35f3c188d56a5c353db98484da1b',
} as const

// ── Person custom fields ───────────────────────────────────────────────────
export const PERSON_FIELD_KEYS = {
  // matched against name="Functie"
  FUNCTIE: 'eff8a3361f8ec8bc1c3edc57b170019bdf9d99f3',
  // matched against name="Linkedin"
  LINKEDIN: '275274fd29282c0679a1e84e7cef010dba5513b0',
} as const

// ── Bedrijfsgrootte enum (Org field) ───────────────────────────────────────
// Bron: opts=[222=Klein < 10, 223=Middel < 100, 224=Groot > 100] op Bedrijfsgrootte.
export const BEDRIJFSGROOTTE_ENUM = {
  KLEIN: 222,
  MIDDEL: 223,
  GROOT: 224,
} as const

export function bedrijfsgrootteToEnum(
  bucket: 'klein_<10' | 'middel_<100' | 'groot_>100' | undefined,
): number | null {
  if (!bucket) return null
  if (bucket === 'klein_<10') return BEDRIJFSGROOTTE_ENUM.KLEIN
  if (bucket === 'middel_<100') return BEDRIJFSGROOTTE_ENUM.MIDDEL
  if (bucket === 'groot_>100') return BEDRIJFSGROOTTE_ENUM.GROOT
  return null
}

// ── WeTarget enum (Org field) ──────────────────────────────────────────────
// Bron: opts=[265=WeTarget, 301=Nee] op WeTarget.
export const WETARGET_ENUM = {
  JA: 265,
  NEE: 301,
} as const

// Hoofddomein-mapping: zie `platforms.pipedrive_hoofddomein_option_id` +
// `sales_lead_owner_config.hoofddomein_fixed_option_id`. Geen hardcoded map
// hier — owner-config (fixed strategy) of platforms-lookup (auto-match
// strategy) levert het ID. PipedriveSyncService resolve't dit en geeft het
// als parameter mee aan `buildOrgPayload`.
