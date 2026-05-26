'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { toast } from 'sonner'
import { Sparkles, Mail, Phone, Loader2 } from 'lucide-react'
import type { ColdContact, SalesLeadRunStatus } from '@/lib/services/sales-leads/types'

type Props = {
  runId: string
  coldCandidates: ColdContact[]
  /** Status van de run. Reveal is alleen toegestaan vóór sync (review/failed). */
  runStatus: SalesLeadRunStatus
  onRevealed: () => void
}

// Volgorde: meest senior eerst. Onbekende seniority gaat naar achteren.
const SENIORITY_RANK: Record<string, number> = {
  owner: 100,
  founder: 95,
  c_suite: 90,
  vp: 80,
  head: 70,
  director: 60,
  manager: 50,
  senior: 40,
  junior: 20,
  intern: 10,
}

const SENIORITY_LABEL: Record<string, string> = {
  owner: 'Owner',
  founder: 'Founder',
  c_suite: 'C-suite',
  vp: 'VP',
  head: 'Head',
  director: 'Director',
  manager: 'Manager',
  senior: 'Senior',
  junior: 'Junior',
  intern: 'Intern',
}

export function LeadColdContactsCard({ runId, coldCandidates, runStatus, onRevealed }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [revealing, setRevealing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Reveal mag alleen voordat de deal naar Pipedrive is gegaan. Backend
  // weigert reveal in syncing/completed/duplicate (Persons zijn dan al
  // aangemaakt). UI blokt de knop proactief zodat sales niet klikt op iets
  // dat sowieso een 400 zou geven.
  const revealBlocked =
    runStatus === 'syncing' || runStatus === 'completed' || runStatus === 'duplicate'

  const sorted = useMemo(() => {
    return [...coldCandidates].sort((a, b) => {
      const ra = SENIORITY_RANK[a.seniority ?? ''] ?? 0
      const rb = SENIORITY_RANK[b.seniority ?? ''] ?? 0
      if (rb !== ra) return rb - ra
      return (a.title ?? '').localeCompare(b.title ?? '')
    })
  }, [coldCandidates])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === sorted.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sorted.map((c) => c.apollo_id)))
    }
  }

  async function performReveal() {
    setConfirmOpen(false)
    if (selected.size === 0) return
    setRevealing(true)
    try {
      const res = await fetch(`/api/sales-leads/${runId}/reveal-contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apollo_ids: Array.from(selected) }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        revealed?: unknown[]
        error?: string
      }
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      toast.success('Contacten verrijkt', {
        description: `${json.revealed?.length ?? 0} via Apollo verrijkt - verschijnen nu in de Contacten-kolom.`,
      })
      setSelected(new Set())
      onRevealed()
    } catch (e) {
      toast.error('Verrijken mislukt', { description: (e as Error).message })
    } finally {
      setRevealing(false)
    }
  }

  if (coldCandidates.length === 0) return null

  const allSelected = selected.size === sorted.length && sorted.length > 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-500" />
          <CardTitle className="text-base">Apollo suggesties ({coldCandidates.length})</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-8"
            onClick={toggleAll}
            disabled={revealing || revealBlocked}
          >
            {allSelected ? 'Niets selecteren' : 'Alles selecteren'}
          </Button>
          <Button
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={revealing || selected.size === 0 || revealBlocked}
            className="bg-orange-500 hover:bg-orange-600"
            title={revealBlocked ? 'Run is al gesynced naar Pipedrive - reveal niet meer mogelijk' : undefined}
          >
            {revealing ? (
              <>
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                Verrijken…
              </>
            ) : (
              <>
                Verrijken{selected.size > 0 ? ` - ${selected.size} credit${selected.size === 1 ? '' : 's'}` : ''}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {revealBlocked && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Reveal is uitgeschakeld omdat de run al naar Pipedrive is gesynced. De Persons staan
            inmiddels in Pipedrive en kunnen daar handmatig worden verrijkt.
          </div>
        )}
        <p className="text-xs text-gray-500">
          Cold leads uit Apollo&apos;s database - gesorteerd op seniority. Vink aan en verrijk
          om volledige naam, e-mail en LinkedIn op te halen (1 credit per contact). Verrijkte
          contacten verschijnen in de Contacten-kolom.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {sorted.map((c) => (
            <ColdRow
              key={c.apollo_id}
              contact={c}
              checked={selected.has(c.apollo_id)}
              onToggle={() => toggle(c.apollo_id)}
              disabled={revealing}
            />
          ))}
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apollo contacten verrijken</AlertDialogTitle>
            <AlertDialogDescription>
              Je staat op het punt {selected.size} contact
              {selected.size === 1 ? '' : 'en'} te verrijken via Apollo. Dit verbruikt{' '}
              {selected.size} credit{selected.size === 1 ? '' : 's'}.
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
    </Card>
  )
}

function ColdRow({
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
  const phoneIcon =
    contact.has_direct_phone === 'yes'
      ? 'text-green-600'
      : contact.has_direct_phone === 'maybe'
      ? 'text-orange-500'
      : 'text-gray-300'
  const emailIcon = contact.has_email ? 'text-green-600' : 'text-gray-300'
  const seniorityLabel = contact.seniority ? SENIORITY_LABEL[contact.seniority] : null
  const dept = contact.departments?.[0]?.replace(/_/g, ' ')

  return (
    <label
      className={`flex items-start gap-2 rounded-md border border-dashed p-2.5 hover:bg-orange-50/50 transition cursor-pointer ${
        checked ? 'bg-orange-50/70 border-orange-300' : 'border-gray-200'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        disabled={disabled}
        className="mt-0.5 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-gray-700 truncate">{displayName || 'Onbekend'}</span>
          <div className="flex items-center gap-1 shrink-0">
            <Mail className={`w-3.5 h-3.5 ${emailIcon}`} />
            <Phone className={`w-3.5 h-3.5 ${phoneIcon}`} />
          </div>
        </div>
        {contact.title && (
          <p className="text-xs text-gray-500 truncate">{contact.title}</p>
        )}
        {(seniorityLabel || dept) && (
          <div className="flex items-center gap-1.5 mt-1">
            {seniorityLabel && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 font-normal">
                {seniorityLabel}
              </Badge>
            )}
            {dept && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 font-normal text-gray-500">
                {dept}
              </Badge>
            )}
          </div>
        )}
      </div>
    </label>
  )
}
