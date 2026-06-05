// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import type { Json } from '@/lib/supabase'
import type {
  NormalizedContact,
  RunEnrichments,
  PerSourceEnrichment,
} from '@/lib/services/sales-leads/types'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

type EditBody = {
  matchKey?: { name?: unknown; email?: unknown }
  updates?: {
    first_name?: unknown
    last_name?: unknown
    title?: unknown
    email?: unknown
    phone_mobile?: unknown
    phone_other?: unknown
  }
}

type UpdatableFields = {
  first_name?: string
  last_name?: string
  title?: string
  email?: string | null
  phone_mobile?: string | null
  phone_other?: string | null
}

/**
 * Edit een contact-record op een run. Wijzigingen worden in-place toegepast op
 *  - enrichments.apollo.parsed.contacts
 *  - enrichments.website.parsed.contacts
 *  - selected_contacts
 * Gematcht op (lowercased trimmed name) + (email of null) — first-hit wins.
 *
 * Pipedrive-sync leest gewoon selected_contacts, dus edits landen in PD bij
 * de volgende sync.
 */
async function handler(req: NextRequest, _auth: AuthResult, ctx: RouteContext) {
  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as EditBody | null
  if (!body) return NextResponse.json({ error: 'Body verplicht' }, { status: 400 })

  const parsed = parseEditBody(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { matchKey, updates } = parsed.value

  const supabase = createServiceRoleClient()
  const { data: run, error: loadErr } = await supabase
    .from('sales_lead_runs')
    .select('id, enrichments, selected_contacts')
    .eq('id', id)
    .maybeSingle()
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
  if (!run) return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })

  const enrichments = (run.enrichments ?? {}) as RunEnrichments
  const selected = (run.selected_contacts ?? []) as NormalizedContact[]

  let foundAnywhere = false
  let updatedContact: NormalizedContact | null = null

  // Apply naar enrichments.apollo.parsed.contacts
  const apollo = enrichments.apollo as PerSourceEnrichment | undefined
  if (apollo?.parsed?.contacts) {
    const next = apollo.parsed.contacts.map((c) => {
      if (!matches(c, matchKey)) return c
      foundAnywhere = true
      const merged = applyUpdates(c, updates)
      updatedContact = merged
      return merged
    })
    apollo.parsed.contacts = next
  }

  // Apply naar enrichments.website.parsed.contacts
  const website = enrichments.website as PerSourceEnrichment | undefined
  if (website?.parsed?.contacts) {
    const next = website.parsed.contacts.map((c) => {
      if (!matches(c, matchKey)) return c
      foundAnywhere = true
      const merged = applyUpdates(c, updates)
      if (!updatedContact) updatedContact = merged
      return merged
    })
    website.parsed.contacts = next
  }

  // Apply naar selected_contacts
  const nextSelected = selected.map((c) => {
    if (!matches(c, matchKey)) return c
    foundAnywhere = true
    const merged = applyUpdates(c, updates)
    if (!updatedContact) updatedContact = merged
    return merged
  })

  if (!foundAnywhere) {
    return NextResponse.json({ error: 'Contact niet gevonden in run' }, { status: 404 })
  }

  const { error: updateErr } = await supabase
    .from('sales_lead_runs')
    .update({
      enrichments: enrichments as unknown as Json,
      selected_contacts: nextSelected as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, contact: updatedContact })
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase()
}

function matches(c: NormalizedContact, key: { name: string; email: string | null }): boolean {
  if (normalizeName(c.name) !== normalizeName(key.name)) return false
  const cEmail = c.email ? c.email.toLowerCase() : null
  const kEmail = key.email ? key.email.toLowerCase() : null
  return cEmail === kEmail
}

function applyUpdates(c: NormalizedContact, updates: UpdatableFields): NormalizedContact {
  const next: NormalizedContact = { ...c }
  if (updates.first_name !== undefined) next.first_name = updates.first_name
  if (updates.last_name !== undefined) next.last_name = updates.last_name
  if (updates.title !== undefined) next.title = updates.title
  if (updates.email !== undefined) next.email = updates.email ?? undefined
  if (updates.phone_mobile !== undefined) next.phone_mobile = updates.phone_mobile ?? undefined
  if (updates.phone_other !== undefined) next.phone_other = updates.phone_other ?? undefined

  // Reconstrueer `name` als first/last is gewijzigd (anders blijft de oude
  // display-name staan en raakt search/dedup uit sync).
  if (updates.first_name !== undefined || updates.last_name !== undefined) {
    const fn = (next.first_name ?? '').trim()
    const ln = (next.last_name ?? '').trim()
    const composed = `${fn} ${ln}`.trim()
    if (composed.length > 0 && composed !== c.name) {
      next.name = composed
      // Markeer als handmatig aangepast zodat de Pipedrive-sync deze naam ook
      // doorzet naar een al bestaande persoon (e-mailmatch), i.p.v. de oude
      // Pipedrive-naam te laten staan.
      next.name_overridden = true
    }
  }
  return next
}

function parseEditBody(
  raw: EditBody,
):
  | {
      ok: true
      value: {
        matchKey: { name: string; email: string | null }
        updates: UpdatableFields
      }
    }
  | { ok: false; error: string } {
  const mk = raw.matchKey
  if (!mk || typeof mk.name !== 'string' || mk.name.trim().length === 0) {
    return { ok: false, error: 'matchKey.name verplicht' }
  }
  const matchEmail =
    mk.email === null || mk.email === undefined
      ? null
      : typeof mk.email === 'string'
      ? mk.email
      : null

  const u = raw.updates ?? {}
  const updates: UpdatableFields = {}
  if (u.first_name !== undefined) {
    if (typeof u.first_name !== 'string') return { ok: false, error: 'first_name moet string zijn' }
    const trimmed = u.first_name.trim()
    if (trimmed.length === 0) return { ok: false, error: 'first_name mag niet leeg zijn' }
    updates.first_name = trimmed
  }
  if (u.last_name !== undefined) {
    if (typeof u.last_name !== 'string') return { ok: false, error: 'last_name moet string zijn' }
    updates.last_name = u.last_name.trim()
  }
  if (u.title !== undefined) {
    if (typeof u.title !== 'string') return { ok: false, error: 'title moet string zijn' }
    updates.title = u.title.trim()
  }
  if (u.email !== undefined) {
    if (u.email === null || u.email === '') updates.email = null
    else if (typeof u.email === 'string') updates.email = u.email.trim()
    else return { ok: false, error: 'email moet string of null zijn' }
  }
  if (u.phone_mobile !== undefined) {
    if (u.phone_mobile === null || u.phone_mobile === '') updates.phone_mobile = null
    else if (typeof u.phone_mobile === 'string') updates.phone_mobile = u.phone_mobile.trim()
    else return { ok: false, error: 'phone_mobile moet string of null zijn' }
  }
  if (u.phone_other !== undefined) {
    if (u.phone_other === null || u.phone_other === '') updates.phone_other = null
    else if (typeof u.phone_other === 'string') updates.phone_other = u.phone_other.trim()
    else return { ok: false, error: 'phone_other moet string of null zijn' }
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: 'updates moet minimaal 1 veld bevatten' }
  }

  return {
    ok: true,
    value: { matchKey: { name: mk.name.trim(), email: matchEmail }, updates },
  }
}

export const PATCH = withAuth(handler)
