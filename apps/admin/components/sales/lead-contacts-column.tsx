'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Star,
  Plus,
  ArrowUp,
  AlertTriangle,
  Mail,
  Phone,
  ChevronDown,
  Sparkles,
  Loader2,
} from 'lucide-react'
import type { ColdContact, NormalizedContact, RunEnrichments } from '@/lib/services/sales-leads/types'
import { LeadAddContactModal } from './lead-add-contact-modal'

type Props = {
  runId: string
  enrichments: RunEnrichments
  selected: NormalizedContact[]
  onChange: (next: NormalizedContact[]) => void
  onRevealed: () => void
}

const MAX_SELECTED = 2

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

function withCappedSelected(
  current: NormalizedContact[],
  next: NormalizedContact,
): NormalizedContact[] {
  if (current.length < MAX_SELECTED) return [...current, next]
  // Bij gelijke score wint de oudste in de array (V8 Array.sort is stable),
  // dus de meest recent toegevoegde laagst-scorende wordt verdrongen.
  const [lowest] = [...current].sort(
    (a, b) => (a.ai_priority_score ?? 0) - (b.ai_priority_score ?? 0),
  )
  return [...current.filter((x) => x !== lowest), next]
}

export function LeadContactsColumn({ runId, enrichments, selected, onChange, onRevealed }: Props) {
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [coldOpen, setColdOpen] = useState(false)
  const [coldSelected, setColdSelected] = useState<Set<string>>(new Set())
  const [revealing, setRevealing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const coldCandidates: ColdContact[] = enrichments.apollo?.parsed?.cold_candidates ?? []
  const apolloStatus = enrichments.apollo?.status
  const apolloHasContacts = (enrichments.apollo?.parsed?.contacts ?? []).length > 0
  const apolloEmpty =
    apolloStatus === 'completed' && coldCandidates.length === 0 && !apolloHasContacts

  function toggleCold(id: string) {
    setColdSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function performReveal() {
    setConfirmOpen(false)
    if (coldSelected.size === 0) return
    setRevealing(true)
    try {
      const res = await fetch(`/api/sales-leads/${runId}/reveal-contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apollo_ids: Array.from(coldSelected) }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        revealed?: NormalizedContact[]
        remaining_cold?: number
        error?: string
      }
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }
      toast({
        title: 'Contacten verrijkt',
        description: `${json.revealed?.length ?? 0} contact${
          (json.revealed?.length ?? 0) === 1 ? '' : 'en'
        } via Apollo verrijkt.`,
      })
      setColdSelected(new Set())
      onRevealed()
    } catch (e) {
      toast({
        title: 'Verrijken mislukt',
        description: (e as Error).message,
        variant: 'destructive',
      })
    } finally {
      setRevealing(false)
    }
  }

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
    onChange(withCappedSelected(selected, c))
  }

  function addManual(c: NormalizedContact) {
    setManualPool((prev) => {
      const key = c.name.trim().toLowerCase()
      if (prev.some((x) => x.name.trim().toLowerCase() === key)) return prev
      return [...prev, c]
    })
    onChange(withCappedSelected(selected, c))
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

        {coldCandidates.length > 0 && (
          <Collapsible open={coldOpen} onOpenChange={setColdOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-left group">
              <span className="text-xs uppercase text-gray-500 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-orange-500" />
                Apollo suggesties ({coldCandidates.length})
              </span>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform ${coldOpen ? 'rotate-180' : ''}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              <p className="text-[11px] text-gray-500">
                Cold leads uit Apollo&apos;s database. Vink aan en verrijk om naam, e-mail
                en LinkedIn op te halen — 1 credit per contact.
              </p>
              <div className="space-y-1.5">
                {coldCandidates.map((c) => (
                  <ColdContactRow
                    key={c.apollo_id}
                    contact={c}
                    checked={coldSelected.has(c.apollo_id)}
                    onToggle={() => toggleCold(c.apollo_id)}
                    disabled={revealing}
                  />
                ))}
              </div>
              {coldSelected.size > 0 && (
                <div className="sticky bottom-0 -mx-3 px-3 py-2 bg-orange-50/95 border-t border-orange-200 backdrop-blur flex items-center justify-between rounded-b-md">
                  <span className="text-xs text-gray-700">
                    <strong>{coldSelected.size}</strong> geselecteerd
                  </span>
                  <Button
                    size="sm"
                    onClick={() => setConfirmOpen(true)}
                    disabled={revealing}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    {revealing ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                        Verrijken…
                      </>
                    ) : (
                      <>Verrijken — {coldSelected.size} credit{coldSelected.size === 1 ? '' : 's'}</>
                    )}
                  </Button>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {apolloEmpty && (
          <div className="rounded-md border-dashed border p-3 text-xs text-gray-500">
            Apollo kent dit bedrijf maar heeft geen mensen-data.
          </div>
        )}

        <LeadAddContactModal open={modalOpen} onOpenChange={setModalOpen} onAdd={addManual} />

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apollo contacten verrijken</AlertDialogTitle>
              <AlertDialogDescription>
                Je staat op het punt {coldSelected.size} contact
                {coldSelected.size === 1 ? '' : 'en'} te verrijken via Apollo. Dit
                verbruikt {coldSelected.size} credit{coldSelected.size === 1 ? '' : 's'}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuleren</AlertDialogCancel>
              <AlertDialogAction onClick={performReveal} className="bg-orange-500 hover:bg-orange-600">
                Bevestigen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

function ColdContactRow({
  contact,
  checked,
  onToggle,
  disabled,
}: {
  contact: ColdContact
  checked: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  const displayName = `${contact.first_name ?? ''} ${contact.last_name_obfuscated ?? ''}`.trim()
  const phoneColor =
    contact.has_direct_phone === 'yes'
      ? 'text-green-600'
      : contact.has_direct_phone === 'maybe'
      ? 'text-orange-500'
      : 'text-gray-300'
  const emailColor = contact.has_email ? 'text-green-600' : 'text-gray-300'

  return (
    <label
      className={`flex items-center gap-2 rounded-md border border-dashed border-gray-200 p-2 hover:bg-orange-50/50 transition cursor-pointer ${
        checked ? 'bg-orange-50/70 border-orange-300' : ''
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        disabled={disabled}
        className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-700">{displayName || 'Onbekend'}</div>
        {contact.title && <div className="text-xs text-gray-500 truncate">{contact.title}</div>}
      </div>
      <div className="flex items-center gap-1.5 text-[11px]">
        <Mail className={`w-3.5 h-3.5 ${emailColor}`} />
        <Phone className={`w-3.5 h-3.5 ${phoneColor}`} />
      </div>
    </label>
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
            {contact.is_warm_lead && contact.source_origin.includes('apollo') && (
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
