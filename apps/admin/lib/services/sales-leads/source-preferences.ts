import { createServiceRoleClient } from '@/lib/supabase-server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NormalizedFields, SourceKey } from './types'

type SB = SupabaseClient

export const SOURCE_PREFERENCE_FIELDS = [
  'address',
  'industry',
  'employee_count',
  'phone',
  'email',
] as const satisfies ReadonlyArray<keyof NormalizedFields>

export const PROTECTED_SOURCE_PREFERENCE_FIELDS = [
  'company_name',
  'kvk_number',
  'website',
] as const satisfies ReadonlyArray<keyof NormalizedFields>

export const SOURCE_PREFERENCE_SOURCES = [
  'website',
  'apollo',
  'google_maps',
  'kvk',
] as const satisfies ReadonlyArray<Exclude<SourceKey, 'custom'>>

export type SourcePreferenceField = (typeof SOURCE_PREFERENCE_FIELDS)[number]
export type ProtectedSourcePreferenceField = (typeof PROTECTED_SOURCE_PREFERENCE_FIELDS)[number]
export type SourcePreferenceSource = (typeof SOURCE_PREFERENCE_SOURCES)[number]
export type SourcePreferences = Record<SourcePreferenceField, SourcePreferenceSource>
export type SourcePreferenceOverrides = Partial<Record<SourcePreferenceField, SourcePreferenceSource>>
export type SourcePreferencePatch = Partial<Record<SourcePreferenceField, SourcePreferenceSource | null>>

export const DEFAULT_SOURCE_PREFERENCES = {
  address: 'website',
  industry: 'apollo',
  employee_count: 'kvk',
  phone: 'website',
  email: 'website',
} as const satisfies SourcePreferences

export type SourcePreferencesResponse = {
  preferences: SourcePreferences
  overrides: SourcePreferenceOverrides
  allowed_fields: SourcePreferenceField[]
  protected_fields: ProtectedSourcePreferenceField[]
  allowed_sources: SourcePreferenceSource[]
  defaults: SourcePreferences
}

type SourcePreferenceRow = {
  field_name: string
  source: string
}

const FIELD_SET = new Set<string>(SOURCE_PREFERENCE_FIELDS)
const PROTECTED_FIELD_SET = new Set<string>(PROTECTED_SOURCE_PREFERENCE_FIELDS)
const SOURCE_SET = new Set<string>(SOURCE_PREFERENCE_SOURCES)

export function isSourcePreferenceField(value: string): value is SourcePreferenceField {
  return FIELD_SET.has(value)
}

export function isSourcePreferenceSource(value: string): value is SourcePreferenceSource {
  return SOURCE_SET.has(value)
}

export function mergeSourcePreferences(overrides: SourcePreferenceOverrides): SourcePreferences {
  return { ...DEFAULT_SOURCE_PREFERENCES, ...overrides }
}

export function rowsToSourcePreferenceOverrides(rows: SourcePreferenceRow[]): SourcePreferenceOverrides {
  const overrides: SourcePreferenceOverrides = {}
  for (const row of rows) {
    if (!isSourcePreferenceField(row.field_name) || !isSourcePreferenceSource(row.source)) continue
    overrides[row.field_name] = row.source
  }
  return overrides
}

export function parseSourcePreferencePatch(input: unknown): SourcePreferencePatch {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Request body must be an object')
  }

  const raw = input as Record<string, unknown>
  const candidate =
    raw.preferences && typeof raw.preferences === 'object' && !Array.isArray(raw.preferences)
      ? (raw.preferences as Record<string, unknown>)
      : raw

  const patch: SourcePreferencePatch = {}
  for (const [field, source] of Object.entries(candidate)) {
    if (field === 'reset' || field === 'preferences') continue
    if (PROTECTED_FIELD_SET.has(field)) {
      throw new Error(`Field is protected and cannot be configured: ${field}`)
    }
    if (!isSourcePreferenceField(field)) {
      throw new Error(`Unknown source preference field: ${field}`)
    }
    if (source === null) {
      patch[field] = null
      continue
    }
    if (typeof source !== 'string' || !isSourcePreferenceSource(source)) {
      throw new Error(`Invalid source for ${field}: ${String(source)}`)
    }
    patch[field] = source
  }
  return patch
}

export function isResetSourcePreferencesRequest(input: unknown): boolean {
  return !!input && typeof input === 'object' && !Array.isArray(input) && (input as { reset?: unknown }).reset === true
}

export function isMissingSourcePreferencesTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const record = error as { code?: unknown; message?: unknown }
  const code = typeof record.code === 'string' ? record.code : ''
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : ''
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    (
      message.includes('sales_lead_source_preferences') &&
      (
        message.includes('does not exist') ||
        message.includes('could not find') ||
        message.includes('schema cache') ||
        message.includes('relation')
      )
    )
  )
}

function metadata(overrides: SourcePreferenceOverrides): SourcePreferencesResponse {
  return {
    preferences: mergeSourcePreferences(overrides),
    overrides,
    allowed_fields: [...SOURCE_PREFERENCE_FIELDS],
    protected_fields: [...PROTECTED_SOURCE_PREFERENCE_FIELDS],
    allowed_sources: [...SOURCE_PREFERENCE_SOURCES],
    defaults: { ...DEFAULT_SOURCE_PREFERENCES },
  }
}

async function loadOverrides(supabase: SB): Promise<SourcePreferenceOverrides> {
  const { data, error } = await supabase
    .from('sales_lead_source_preferences')
    .select('field_name, source')
    .order('field_name', { ascending: true })
  if (error) {
    if (isMissingSourcePreferencesTableError(error)) {
      console.warn(
        '[source-preferences] sales_lead_source_preferences ontbreekt; gebruik app-defaults totdat de migratie is toegepast.',
      )
      return {}
    }
    throw new Error(`Kon source preferences niet laden: ${error.message}`)
  }
  return rowsToSourcePreferenceOverrides((data ?? []) as SourcePreferenceRow[])
}

export async function getSourcePreferences(opts?: { supabase?: SB }): Promise<SourcePreferencesResponse> {
  const supabase = opts?.supabase ?? (createServiceRoleClient() as unknown as SB)
  return metadata(await loadOverrides(supabase))
}

export async function loadSourcePreferences(supabase?: SB): Promise<SourcePreferences> {
  return (await getSourcePreferences({ supabase })).preferences
}

export async function updateSourcePreferences(
  patch: SourcePreferencePatch,
  opts?: { supabase?: SB; updatedBy?: string },
): Promise<SourcePreferencesResponse> {
  const supabase = opts?.supabase ?? (createServiceRoleClient() as unknown as SB)
  const entries = Object.entries(patch) as Array<[SourcePreferenceField, SourcePreferenceSource | null | undefined]>
  const deletes = entries.filter(([, source]) => source === null).map(([field]) => field)
  const upserts = entries
    .filter((entry): entry is [SourcePreferenceField, SourcePreferenceSource] => entry[1] != null)
    .map(([field_name, source]) => ({
      field_name,
      source,
      updated_by: opts?.updatedBy ?? null,
    }))

  if (upserts.length > 0) {
    const { error } = await supabase
      .from('sales_lead_source_preferences')
      .upsert(upserts, { onConflict: 'field_name' })
    if (error) {
      throw new Error(`Kon source preferences niet opslaan: ${error.message}`)
    }
  }

  if (deletes.length > 0) {
    const { error } = await supabase
      .from('sales_lead_source_preferences')
      .delete()
      .in('field_name', deletes)
    if (error) {
      throw new Error(`Kon source preferences niet resetten: ${error.message}`)
    }
  }

  return metadata(await loadOverrides(supabase))
}

export async function resetSourcePreferences(opts?: { supabase?: SB }): Promise<SourcePreferencesResponse> {
  const supabase = opts?.supabase ?? (createServiceRoleClient() as unknown as SB)
  const { error } = await supabase
    .from('sales_lead_source_preferences')
    .delete()
    .in('field_name', [...SOURCE_PREFERENCE_FIELDS])
  if (error) {
    throw new Error(`Kon source preferences niet resetten: ${error.message}`)
  }
  return metadata({})
}
