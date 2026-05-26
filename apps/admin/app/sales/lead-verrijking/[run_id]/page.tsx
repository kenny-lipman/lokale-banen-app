'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePollingRun } from '@/hooks/use-polling-run'
import { useDebounce } from '@/hooks/use-debounce'
import { useToast } from '@/hooks/use-toast'
import { LeadStatusBanner, type SaveState } from '@/components/sales/lead-status-banner'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { LeadSourceStatusGrid } from '@/components/sales/lead-source-status-grid'
import { LeadSyncStatus } from '@/components/sales/lead-sync-status'
import { LeadMasterRecord } from '@/components/sales/lead-master-record'
import { LeadContactsColumn } from '@/components/sales/lead-contacts-column'
import { LeadColdContactsCard } from '@/components/sales/lead-cold-contacts-card'
import { LeadVacanciesColumn } from '@/components/sales/lead-vacancies-column'
import { LeadDealNoteTextarea } from '@/components/sales/lead-deal-note-textarea'
import { LeadBrancheSelect } from '@/components/sales/lead-branche-select'
import { LeadContactmomentPicker } from '@/components/sales/lead-contactmoment-picker'
import { extractApex } from '@/lib/utils/url'
import { LeadDiscrepancyWarnings } from '@/components/sales/lead-discrepancy-warnings'
import { LeadCareerPageSuggestions } from '@/components/sales/lead-career-page-suggestions'
import { LeadSitemapPages } from '@/components/sales/lead-sitemap-pages'
import type { MasterRecord, NormalizedContact, NormalizedVacancy } from '@/lib/services/sales-leads/types'

type PageProps = { params: Promise<{ run_id: string }> }
type OwnerConfig = {
  id: string
  label?: string
  hoofddomein_strategy: 'fixed' | 'auto_match_by_address'
  hoofddomein_fixed_value: string | null
}

// Backend POST /create slaat manual_vacancies op zonder `source`-veld. Hier
// wordt het op `'manual'` gezet zodat NormalizedVacancy-shape compleet is en
// de UI-source-badge correct rendert.
function normalizeManualVacancies(raw: unknown): NormalizedVacancy[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((v): NormalizedVacancy[] => {
    if (!v || typeof v !== 'object') return []
    const r = v as { title?: unknown; url?: unknown; location?: unknown }
    if (typeof r.title !== 'string' || !r.title.trim()) return []
    return [
      {
        title: r.title,
        url: typeof r.url === 'string' ? r.url : undefined,
        location: typeof r.location === 'string' ? r.location : undefined,
        source: 'manual',
      },
    ]
  })
}

// Dedupe op `title.trim().toLowerCase()`. Eerste voorkomen wint — gebruik
// dus volgorde manual-eerst zodat manual-source en -url winnen bij conflict.
function dedupeVacancies(list: NormalizedVacancy[]): NormalizedVacancy[] {
  const seen = new Set<string>()
  const out: NormalizedVacancy[] = []
  for (const v of list) {
    const k = v.title.trim().toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(v)
  }
  return out
}

export default function RunDetailPage({ params }: PageProps) {
  const { run_id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const { run, loading, error, timedOut, refetch } = usePollingRun(run_id)

  const [master, setMaster] = useState<MasterRecord | null>(null)
  const [selected, setSelected] = useState<NormalizedContact[]>([])
  const [owners, setOwners] = useState<OwnerConfig[] | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync run → lokale state bij eerste review-load. Daarna laten we lokale state leiden
  // (anders overschrijft polling user-edits).
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!run) return
    if (run.status === 'enriching') return
    if (hydratedRef.current) return
    // Wacht met hydratie tot master_record daadwerkelijk geladen is — anders
    // race tussen onReplay (zet hydratedRef=false + refetch) en de async
    // orchestrator: eerste polling-tick zou master kunnen hydraten als null en
    // hydratedRef pinnen op true vóórdat de orchestrator klaar is.
    if (!run.master_record) return
    const initial = run.master_record ? { ...run.master_record } : null
    if (initial && (!initial.vacancies || initial.vacancies.length === 0)) {
      const manual = normalizeManualVacancies(run.manual_vacancies)
      const auto = run.enrichments?.website?.parsed?.vacancies ?? []
      initial.vacancies = dedupeVacancies([...manual, ...auto])
    }
    setMaster(initial)
    setSelected((run.selected_contacts ?? []) as NormalizedContact[])
    hydratedRef.current = true
  }, [run])

  useEffect(() => {
    fetch('/api/sales-leads/owner-config')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ configs?: OwnerConfig[] }>
      })
      .then((j) => setOwners(j.configs ?? []))
      .catch((e) => {
        toast({
          title: 'Kon owner-config niet laden',
          description: (e as Error).message,
          variant: 'destructive',
        })
      })
  }, [toast])

  // Debounced auto-save
  const debouncedMaster = useDebounce(master, 500)
  const debouncedSelected = useDebounce(selected, 500)
  const lastSentRef = useRef<string>('')
  const seqRef = useRef(0)
  useEffect(() => {
    if (!hydratedRef.current || !run || run.status !== 'review') return
    const payload = JSON.stringify({
      master_record: debouncedMaster,
      selected_contacts: debouncedSelected,
    })
    if (payload === lastSentRef.current) return
    lastSentRef.current = payload
    const mySeq = ++seqRef.current
    setSaveState('saving')
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current)
      savedTimerRef.current = null
    }
    void fetch(`/api/sales-leads/${run_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }
        if (seqRef.current !== mySeq) return
        setSaveState('saved')
        savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2000)
      })
      .catch((e) => {
        if (seqRef.current !== mySeq) return // newer save in flight, swallow
        setSaveState('error')
        toast({
          title: 'Auto-save mislukt',
          description: (e as Error).message,
          variant: 'destructive',
        })
      })
  }, [debouncedMaster, debouncedSelected, run_id, run, toast])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  // Na promote-candidate: server heeft master_record + enrichments al gemerged.
  // Reset hydration zodat local master uit de fresh server-state wordt overschreven
  // voor de Maps-velden. User-edits op andere velden blijven via server-merge behouden.
  const onCandidatePromoted = useCallback(async () => {
    hydratedRef.current = false
    await refetch()
  }, [refetch])

  const onCancel = useCallback(async () => {
    setCancelling(true)
    try {
      const res = await fetch(`/api/sales-leads/${run_id}/cancel`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Cancel mislukt')
      toast({ title: 'Run geannuleerd', variant: 'default' })
      router.push('/sales/lead-verrijking')
    } catch (e) {
      toast({ title: 'Cancel mislukt', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setCancelling(false)
    }
  }, [run_id, router, toast])

  const onReplay = useCallback(async () => {
    setReplaying(true)
    try {
      const res = await fetch(`/api/sales-leads/${run_id}/replay`, { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      toast({ title: 'Replay gestart' })
      // Reset hydration zodat master/selected uit de fresh enriching-state
      // worden ge-rehydrated zodra orchestrator klaar is.
      hydratedRef.current = false
      setMaster(null)
      setSelected([])
      await refetch()
    } catch (e) {
      toast({
        title: 'Replay mislukt',
        description: (e as Error).message,
        variant: 'destructive',
      })
    } finally {
      setReplaying(false)
    }
  }, [run_id, refetch, toast])

  if (loading && !run) return <div className="p-8 text-sm text-gray-500">Laden…</div>
  if (error && !run) return <div className="p-8 text-sm text-red-600">{error}</div>
  if (!run) return <div className="p-8 text-sm text-gray-500">Run niet gevonden.</div>

  const ownerConfig = owners?.find((o) => o.id === run.owner_config_id) ?? null
  // Toon review-grid op alle terminale states zolang master_record bestaat:
  //  - review            → user moet kunnen editen vóór sync
  //  - syncing/completed → na sync wil user de gesyncte data kunnen inzien
  //  - failed            → na sync-faal moet user kunnen retryen zonder verlies
  //  - duplicate         → na dedupe-stop wil user zien wat we wilden syncen
  // Bij failed/completed/syncing/duplicate zonder master_record (zeldzaam:
  // enrichment crashte vóór finalize) → fallback naar alleen source-cards.
  const showReview =
    !!run.master_record &&
    (run.status === 'review' ||
      run.status === 'syncing' ||
      run.status === 'completed' ||
      run.status === 'duplicate' ||
      run.status === 'failed')
  const showEnriching = run.status === 'enriching'
  const showSyncCard =
    run.status === 'review' ||
    run.status === 'syncing' ||
    run.status === 'completed' ||
    run.status === 'failed' ||
    run.status === 'duplicate'

  function renderReviewGrid(currentMaster: MasterRecord) {
    const manualVacancies = normalizeManualVacancies(run!.manual_vacancies)
    const websiteVacancies = run!.enrichments?.website?.parsed?.vacancies ?? []
    const allVacancies = dedupeVacancies([...manualVacancies, ...websiteVacancies])
    const selectedTitleSet = new Set(
      (currentMaster.vacancies ?? []).map((v) => v.title.trim().toLowerCase()),
    )
    const selectedVacancyTitles = allVacancies
      .filter((v) => selectedTitleSet.has(v.title.trim().toLowerCase()))
      .map((v) => v.title)
    const selectedVacancies = allVacancies.filter((v) =>
      selectedTitleSet.has(v.title.trim().toLowerCase()),
    )

    function setSelectedVacancyTitles(titles: string[]) {
      const lower = new Set(titles.map((t) => t.trim().toLowerCase()))
      const next = allVacancies.filter((v) => lower.has(v.title.trim().toLowerCase()))
      setMaster({ ...currentMaster, vacancies: next })
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <LeadMasterRecord
            runId={run_id}
            master={currentMaster}
            enrichments={run!.enrichments ?? {}}
            ownerConfig={ownerConfig}
            onChange={setMaster}
          />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <LeadContactsColumn
            enrichments={run!.enrichments ?? {}}
            selected={selected}
            onChange={setSelected}
            runId={run_id}
            onContactEdited={onCandidatePromoted}
            companyDomain={run!.input_domain ? extractApex(run!.input_domain) : null}
            companyPhone={currentMaster.phone ?? null}
          />
          <LeadVacanciesColumn
            manualVacancies={manualVacancies}
            enrichments={run!.enrichments ?? {}}
            selectedTitles={selectedVacancyTitles}
            onChange={setSelectedVacancyTitles}
          />
        </div>
        <div className="lg:col-span-5 space-y-4">
          <LeadCareerPageSuggestions runId={run_id} />
          {/* pages_crawled/pages_discovered direct uit fresh run-data lezen
              i.p.v. lokale `currentMaster` — die wordt door `hydratedRef`
              maar éénmaal gehydrateerd en mist updates uit een website-replay. */}
          <LeadSitemapPages
            master={{
              ...currentMaster,
              pages_crawled: run!.master_record?.pages_crawled ?? currentMaster.pages_crawled,
              pages_discovered: run!.master_record?.pages_discovered ?? currentMaster.pages_discovered,
            }}
          />
          <LeadColdContactsCard
            runId={run_id}
            coldCandidates={run!.enrichments?.apollo?.parsed?.cold_candidates ?? []}
            onRevealed={() => {
              hydratedRef.current = false
              void refetch()
            }}
          />
          <LeadDiscrepancyWarnings enrichments={run!.enrichments ?? {}} master={currentMaster} />
          <LeadContactmomentPicker
            runId={run!.id}
            contactmomentOverride={run!.contactmoment_override ?? null}
            onChange={() => {
              hydratedRef.current = false
              void refetch()
            }}
          />
          <LeadBrancheSelect
            runId={run!.id}
            brancheOverride={run!.branche_override ?? null}
            suggestion={currentMaster.branche_suggestion ?? null}
            onChange={({ deal_note_text }) => {
              // PATCH-endpoint regenereert de note met het nieuwe branche-label.
              // Trigger refetch zodat run.branche_override en master_record meegaan
              // in de polling-state; ook lokaal alvast updaten zodat de note-card
              // direct refresh't.
              if (deal_note_text) {
                setMaster({ ...currentMaster, deal_note_text })
              }
              hydratedRef.current = false
              void refetch()
            }}
          />
          <LeadDealNoteTextarea
            runId={run!.id}
            note={currentMaster.deal_note_text ?? ''}
            onChange={(note) => setMaster({ ...currentMaster, deal_note_text: note })}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <LeadStatusBanner
        run={run}
        onCancel={cancelling ? undefined : onCancel}
        onReplay={onReplay}
        replaying={replaying}
        saveState={saveState}
      />
      <LeadSourceStatusGrid
        enrichments={run.enrichments ?? {}}
        runStatus={run.status}
        runId={run_id}
        inputDomain={run.input_domain}
        onCandidatePromoted={onCandidatePromoted}
      />
      {timedOut && showEnriching && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
          <div>
            <p className="font-medium">Polling time-out na 5 minuten.</p>
            <p className="text-xs mt-1">
              De orchestrator draait waarschijnlijk nog — handmatig vernieuwen om de status opnieuw op te halen.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="w-3 h-3 mr-1" />
            Vernieuwen
          </Button>
        </div>
      )}
      {showEnriching && (
        <div className="rounded-md border border-dashed p-6 text-sm text-gray-500">
          Verrijking loopt — review verschijnt zodra de orchestrator klaar is.
        </div>
      )}
      {showReview && master && renderReviewGrid(master)}
      {showSyncCard && (
        <div className="mt-6">
          <LeadSyncStatus
            run={run}
            ownerLabel={ownerConfig?.label ?? null}
            onSynced={async () => {
              hydratedRef.current = false
              await refetch()
            }}
          />
        </div>
      )}
    </div>
  )
}
