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
import { LeadStep3Placeholder } from '@/components/sales/lead-step3-placeholder'
import { LeadMasterRecord } from '@/components/sales/lead-master-record'
import { LeadContactsColumn } from '@/components/sales/lead-contacts-column'
import { LeadVacanciesColumn } from '@/components/sales/lead-vacancies-column'
import { LeadDealNoteTextarea } from '@/components/sales/lead-deal-note-textarea'
import { LeadDiscrepancyWarnings } from '@/components/sales/lead-discrepancy-warnings'
import type { MasterRecord, NormalizedContact, NormalizedVacancy } from '@/lib/services/sales-leads/types'
import { authFetch } from '@/lib/authenticated-fetch'

type PageProps = { params: Promise<{ run_id: string }> }
type OwnerConfig = {
  id: string
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
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync run → lokale state bij eerste review-load. Daarna laten we lokale state leiden
  // (anders overschrijft polling user-edits).
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!run) return
    if (run.status === 'enriching') return
    if (hydratedRef.current) return
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
    authFetch('/api/sales-leads/owner-config')
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
    void authFetch(`/api/sales-leads/${run_id}`, {
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

  const onCancel = useCallback(async () => {
    setCancelling(true)
    try {
      const res = await authFetch(`/api/sales-leads/${run_id}/cancel`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Cancel mislukt')
      toast({ title: 'Run geannuleerd', variant: 'default' })
      router.push('/sales/lead-verrijking')
    } catch (e) {
      toast({ title: 'Cancel mislukt', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setCancelling(false)
    }
  }, [run_id, router, toast])

  if (loading && !run) return <div className="p-8 text-sm text-gray-500">Laden…</div>
  if (error && !run) return <div className="p-8 text-sm text-red-600">{error}</div>
  if (!run) return <div className="p-8 text-sm text-gray-500">Run niet gevonden.</div>

  const ownerConfig = owners?.find((o) => o.id === run.owner_config_id) ?? null
  const showReview = run.status === 'review'
  const showEnriching = run.status === 'enriching'
  const showStep3 =
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
          />
          <LeadVacanciesColumn
            manualVacancies={manualVacancies}
            enrichments={run!.enrichments ?? {}}
            selectedTitles={selectedVacancyTitles}
            onChange={setSelectedVacancyTitles}
          />
        </div>
        <div className="lg:col-span-5 space-y-4">
          <LeadDiscrepancyWarnings enrichments={run!.enrichments ?? {}} master={currentMaster} />
          <LeadDealNoteTextarea
            master={currentMaster}
            enrichments={run!.enrichments ?? {}}
            selectedVacancies={selectedVacancies}
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
        saveState={saveState}
      />
      <LeadSourceStatusGrid enrichments={run.enrichments ?? {}} />
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
      {showStep3 && <LeadStep3Placeholder run={run} />}
      {!showReview && !showEnriching && !showStep3 && (
        <div className="rounded-md border border-dashed p-6 text-sm text-gray-500">
          Status: <span className="font-mono">{run.status}</span>
        </div>
      )}
    </div>
  )
}
