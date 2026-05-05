'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Star, Plus, ArrowUp, AlertTriangle } from 'lucide-react'
import type { NormalizedContact, RunEnrichments } from '@/lib/services/sales-leads/types'
import { LeadAddContactModal } from './lead-add-contact-modal'

type Props = {
  enrichments: RunEnrichments
  selected: NormalizedContact[]
  onChange: (next: NormalizedContact[]) => void
}

const MAX_SELECTED = 2

function dedupe(contacts: NormalizedContact[]): NormalizedContact[] {
  const seen = new Map<string, NormalizedContact>()
  for (const c of contacts) {
    const key = c.name.trim().toLowerCase()
    if (!seen.has(key)) {
      seen.set(key, c)
    } else {
      const prev = seen.get(key)!
      const mergedOrigins = Array.from(
        new Set([...prev.source_origin, ...c.source_origin]),
      ) as NormalizedContact['source_origin']
      seen.set(key, {
        ...prev,
        ...c,
        source_origin: mergedOrigins,
        is_warm_lead: prev.is_warm_lead || c.is_warm_lead,
        ai_priority_score: prev.ai_priority_score ?? c.ai_priority_score,
        ai_priority_reason: prev.ai_priority_reason ?? c.ai_priority_reason,
      })
    }
  }
  return Array.from(seen.values())
}

export function LeadContactsColumn({ enrichments, selected, onChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  const allCandidates = useMemo(() => {
    const apollo = enrichments.apollo?.parsed?.contacts ?? []
    const website = enrichments.website?.parsed?.contacts ?? []
    return dedupe([...apollo, ...website, ...selected.filter((c) => c.source_origin.includes('manual'))])
  }, [enrichments, selected])

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
    if (selected.length < MAX_SELECTED) {
      onChange([...selected, c])
      return
    }
    // Wissel met laagst-gerangschikte selected
    const sorted = [...selected].sort(
      (a, b) => (a.ai_priority_score ?? 0) - (b.ai_priority_score ?? 0),
    )
    const lowest = sorted[0]
    onChange([...selected.filter((x) => x !== lowest), c])
  }

  function addManual(c: NormalizedContact) {
    if (selected.length >= MAX_SELECTED) {
      const sorted = [...selected].sort((a, b) => (a.ai_priority_score ?? 0) - (b.ai_priority_score ?? 0))
      onChange([...selected.filter((x) => x !== sorted[0]), c])
    } else {
      onChange([...selected, c])
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Contacten</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
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
              <ContactCard key={c.name} contact={c} highlighted onClick={() => toggleSelect(c)} />
            ))}
            {selected.length === 1 && (
              <p className="text-xs text-gray-500">1 contact geselecteerd — klik op een ander om +1.</p>
            )}
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
                  swapHint={selected.length >= MAX_SELECTED}
                />
              ))}
            </div>
          </div>
        )}

        <LeadAddContactModal open={modalOpen} onOpenChange={setModalOpen} onAdd={addManual} />
      </CardContent>
    </Card>
  )
}

function ContactCard({
  contact,
  highlighted,
  swapHint,
  onClick,
}: {
  contact: NormalizedContact
  highlighted?: boolean
  swapHint?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-md border p-3 hover:bg-orange-50 transition ${
        highlighted ? 'border-orange-300 bg-orange-50/50' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{contact.name}</span>
            {contact.is_warm_lead && (
              <Badge variant="outline" className="text-yellow-700 border-yellow-300 text-[10px]">
                <AlertTriangle className="w-3 h-3 mr-0.5" />
                Apollo CRM
              </Badge>
            )}
          </div>
          {contact.title && <p className="text-xs text-gray-500">{contact.title}</p>}
          <p className="text-[11px] text-gray-400 mt-1">
            {contact.email ?? 'geen e-mail'} · {contact.phone_mobile ?? '—'}
          </p>
          {contact.ai_priority_reason && (
            <p className="text-[11px] text-gray-500 mt-1 italic">{contact.ai_priority_reason}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {contact.ai_priority_score !== undefined && (
            <span className="flex items-center text-xs text-orange-600">
              <Star className="w-3 h-3 mr-0.5 fill-orange-500" />
              {contact.ai_priority_score}
            </span>
          )}
          {swapHint && <ArrowUp className="w-3 h-3 text-gray-400" />}
        </div>
      </div>
    </button>
  )
}
