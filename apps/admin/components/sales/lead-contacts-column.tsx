'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Star, Plus, AlertTriangle, Pencil } from 'lucide-react'
import type { NormalizedContact, RunEnrichments } from '@/lib/services/sales-leads/types'
import { LeadAddContactModal } from './lead-add-contact-modal'
import { LeadEditContactModal } from './lead-edit-contact-modal'

type Props = {
  enrichments: RunEnrichments
  selected: NormalizedContact[]
  onChange: (next: NormalizedContact[]) => void
  runId?: string
  onContactEdited?: () => void | Promise<void>
  /** Domein van de master (voor info@-fallback display). */
  companyDomain?: string | null
  /** Bedrijfstelefoon uit master (voor phone-fallback display). */
  companyPhone?: string | null
}

function dedupe(contacts: NormalizedContact[]): NormalizedContact[] {
  const seen = new Map<string, NormalizedContact>()
  for (const c of contacts) {
    const key = c.name.trim().toLowerCase()
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, c)
      continue
    }
    const mergedOrigins = Array.from(
      new Set<NormalizedContact['source_origin'][number]>([
        ...existing.source_origin,
        ...c.source_origin,
      ]),
    )
    // Volgorde: Apollo komt eerst in de input-array, dus `existing` is canoniek
    // voor identity-velden (email/title/linkedin/phones). `c` levert alleen
    // fallbacks.
    const merged: NormalizedContact = {
      ...c,
      ...existing,
      email: existing.email ?? c.email,
      title: existing.title ?? c.title,
      phone_mobile: existing.phone_mobile ?? c.phone_mobile,
      phone_other: existing.phone_other ?? c.phone_other,
      linkedin_url: existing.linkedin_url ?? c.linkedin_url,
      email_verified: existing.email_verified || c.email_verified,
      source_origin: mergedOrigins,
      is_warm_lead: existing.is_warm_lead || c.is_warm_lead,
      ai_priority_score: existing.ai_priority_score ?? c.ai_priority_score,
      ai_priority_reason: existing.ai_priority_reason ?? c.ai_priority_reason,
    }
    seen.set(key, merged)
  }
  return Array.from(seen.values())
}

export function LeadContactsColumn({
  enrichments,
  selected,
  onChange,
  runId,
  onContactEdited,
  companyDomain,
  companyPhone,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<NormalizedContact | null>(null)

  const coldCount = enrichments.apollo?.parsed?.cold_candidates?.length ?? 0
  const apolloStatus = enrichments.apollo?.status
  const apolloHasContacts = (enrichments.apollo?.parsed?.contacts ?? []).length > 0
  const apolloEmpty = apolloStatus === 'completed' && coldCount === 0 && !apolloHasContacts

  // Manual contacten zijn binnen-sessie persistent: ze blijven zichtbaar in
  // "niet geselecteerd" ook na deselect of swap. Bij page-refresh bevat
  // `selected_contacts` (DB jsonb) alleen nog-geselecteerde manuals — de rest
  // gaat verloren. Dat is bewust: niet-gekozen manuals worden niet
  // gepersisteerd.
  const [manualPool, setManualPool] = useState<NormalizedContact[]>(() =>
    selected.filter((c) => c.source_origin.includes('manual')),
  )

  // Wanneer hydration vanuit `selected` nieuwe manuals binnenbrengt (bv.
  // initial page-load met DB-data), merge ze in de pool zonder bestaande
  // entries te verwijderen.
  useEffect(() => {
    setManualPool((prev) => {
      const seenKeys = new Set(prev.map((c) => c.name.trim().toLowerCase()))
      const additions = selected
        .filter((c) => c.source_origin.includes('manual'))
        .filter((c) => !seenKeys.has(c.name.trim().toLowerCase()))
      if (additions.length === 0) return prev
      return [...prev, ...additions]
    })
  }, [selected])

  const allCandidates = useMemo(() => {
    const apollo = enrichments.apollo?.parsed?.contacts ?? []
    const website = enrichments.website?.parsed?.contacts ?? []
    return dedupe([...apollo, ...website, ...manualPool])
  }, [enrichments, manualPool])

  const selectedKeys = new Set(selected.map((c) => c.name.trim().toLowerCase()))
  const notSelected = allCandidates
    .filter((c) => !selectedKeys.has(c.name.trim().toLowerCase()))
    .sort((a, b) => (b.ai_priority_score ?? 0) - (a.ai_priority_score ?? 0))

  function toggleSelect(c: NormalizedContact) {
    const key = c.name.trim().toLowerCase()
    const isSelected = selectedKeys.has(key)
    if (isSelected) {
      onChange(selected.filter((x) => x.name.trim().toLowerCase() !== key))
      return
    }
    onChange([...selected, c])
  }

  function addManual(c: NormalizedContact) {
    setManualPool((prev) => {
      const key = c.name.trim().toLowerCase()
      if (prev.some((x) => x.name.trim().toLowerCase() === key)) return prev
      return [...prev, c]
    })
    onChange([...selected, c])
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Contacten</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setModalOpen(true)}>
          <Plus className="size-4 mr-1" />
          Handmatig
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {selected.length === 0 ? (
          <div className="rounded-md border-dashed border p-3 text-xs text-gray-500">
            Géén contact geselecteerd. Pipedrive-deal wordt zonder Person aangemaakt.
          </div>
        ) : (
          <div className="space-y-2">
            {selected.map((c) => (
              <ContactCard
                key={c.name}
                contact={c}
                highlighted
                onClick={() => toggleSelect(c)}
                onEdit={runId ? () => setEditingContact(c) : undefined}
                companyDomain={companyDomain}
                companyPhone={companyPhone}
              />
            ))}
          </div>
        )}

        {notSelected.length > 0 && (
          <div>
            <h4 className="text-xs uppercase text-gray-500 mb-2">Niet geselecteerd</h4>
            <div className="space-y-2">
              {notSelected.map((c) => (
                <ContactCard
                  key={c.name}
                  contact={c}
                  onClick={() => toggleSelect(c)}
                  onEdit={runId ? () => setEditingContact(c) : undefined}
                  companyDomain={companyDomain}
                  companyPhone={companyPhone}
                />
              ))}
            </div>
          </div>
        )}

        {apolloEmpty && (
          <div className="rounded-md border-dashed border p-3 text-xs text-gray-500">
            Apollo kent dit bedrijf maar heeft geen mensen-data.
          </div>
        )}
        {coldCount > 0 && selected.length === 0 && !apolloHasContacts && (
          <p className="text-[11px] text-gray-500">
            {coldCount} Apollo suggesties beschikbaar — zie sectie hieronder.
          </p>
        )}

        <LeadAddContactModal open={modalOpen} onOpenChange={setModalOpen} onAdd={addManual} />
        {runId && (
          <LeadEditContactModal
            open={editingContact !== null}
            onOpenChange={(o) => { if (!o) setEditingContact(null) }}
            contact={editingContact}
            runId={runId}
            onSaved={onContactEdited}
          />
        )}
      </CardContent>
    </Card>
  )
}

function ContactCard({
  contact,
  highlighted,
  onClick,
  onEdit,
  companyDomain,
  companyPhone,
}: {
  contact: NormalizedContact
  highlighted?: boolean
  onClick: () => void
  onEdit?: () => void
  companyDomain?: string | null
  companyPhone?: string | null
}) {
  // Display-fallbacks die spiegelen wat buildPersonPayload bij sync gebruikt.
  // Hiermee ziet sales op de review-pagina vóór sync wat er straks in
  // Pipedrive komt te staan — geen verrassingen achteraf.
  const fallbackEmail = !contact.email && companyDomain ? `info@${companyDomain}` : null
  const displayPhone = contact.phone_mobile ?? contact.phone_other ?? null
  const fallbackPhone = !displayPhone && companyPhone ? companyPhone : null
  return (
    <div
      className={`relative w-full rounded-md border hover:bg-orange-50 transition ${
        highlighted ? 'border-orange-300 bg-orange-50/50' : 'border-gray-200'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left p-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 pr-7">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{contact.name}</span>
              {contact.is_warm_lead && contact.source_origin.includes('apollo') && (
                <Badge variant="outline" className="text-yellow-700 border-yellow-300 text-[10px]">
                  <AlertTriangle className="size-3 mr-0.5" />
                  Apollo CRM
                </Badge>
              )}
            </div>
            {contact.title && <p className="text-xs text-gray-500">{contact.title}</p>}
            <p className="text-[11px] text-gray-400 mt-1">
              {contact.email ? (
                contact.email
              ) : fallbackEmail ? (
                <span className="text-amber-600">{fallbackEmail} <span className="text-[10px]">(info-fallback)</span></span>
              ) : (
                'geen e-mail'
              )}
              {' · '}
              {displayPhone ? (
                displayPhone
              ) : fallbackPhone ? (
                <span className="text-amber-600">{fallbackPhone} <span className="text-[10px]">(bedrijfsnummer)</span></span>
              ) : (
                '—'
              )}
            </p>
            {contact.ai_priority_reason && (
              <p className="text-[11px] text-gray-500 mt-1 italic">{contact.ai_priority_reason}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {contact.ai_priority_score !== undefined && (
              <span className="flex items-center text-xs text-orange-600">
                <Star className="size-3 mr-0.5 fill-orange-500" />
                {contact.ai_priority_score}
              </span>
            )}
          </div>
        </div>
      </button>
      {onEdit && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          aria-label="Contact bewerken"
          className="absolute top-2 right-2 p-1 rounded text-gray-400 hover:text-orange-700 hover:bg-white transition"
        >
          <Pencil className="size-3.5" />
        </button>
      )}
    </div>
  )
}
