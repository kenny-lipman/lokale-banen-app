import { createServiceRoleClient } from '@/lib/supabase-server'
import type { SupabaseClient } from '@supabase/supabase-js'

type SB = SupabaseClient

export type BrancheOption = {
  pipedrive_enum_id: number
  label: string
  sort_order: number
  sbi_prefixes: string[]
  active: boolean
}

const TTL_MS = 5 * 60 * 1000

let cache: { data: BrancheOption[]; expiresAt: number } | null = null

async function loadFromDb(supabase: SB): Promise<BrancheOption[]> {
  const { data, error } = await supabase
    .from('pipedrive_branche_options')
    .select('pipedrive_enum_id, label, sort_order, sbi_prefixes, active')
    .order('sort_order', { ascending: true })
  if (error) {
    throw new Error(`Kon branche-opties niet laden: ${error.message}`)
  }
  return (data ?? []) as BrancheOption[]
}

async function getAll(supabase?: SB): Promise<BrancheOption[]> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) return cache.data
  const sb = supabase ?? (createServiceRoleClient() as unknown as SB)
  const data = await loadFromDb(sb)
  cache = { data, expiresAt: now + TTL_MS }
  return data
}

export async function getBrancheOptions(opts?: {
  supabase?: SB
  includeInactive?: boolean
}): Promise<BrancheOption[]> {
  const all = await getAll(opts?.supabase)
  return opts?.includeInactive ? all : all.filter((o) => o.active)
}

export async function findEnumIdForSbi(
  sbi: string | null | undefined,
  supabase?: SB,
): Promise<number | null> {
  if (!sbi) return null
  const prefix = String(sbi).trim().slice(0, 2)
  if (!prefix) return null
  const active = await getBrancheOptions({ supabase })
  for (const opt of active) {
    if (opt.sbi_prefixes.includes(prefix)) return opt.pipedrive_enum_id
  }
  return null
}

export async function getBrancheLabel(
  enumId: number | null | undefined,
  supabase?: SB,
): Promise<string | null> {
  if (enumId == null) return null
  const all = await getAll(supabase)
  return all.find((o) => o.pipedrive_enum_id === enumId)?.label ?? null
}

export function invalidateBrancheOptionsCache(): void {
  cache = null
}
