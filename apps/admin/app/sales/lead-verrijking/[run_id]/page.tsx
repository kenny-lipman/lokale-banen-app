'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePollingRun } from '@/hooks/use-polling-run'
import { useDebounce } from '@/hooks/use-debounce'
import { useToast } from '@/hooks/use-toast'
import { LeadStatusBanner } from '@/components/sales/lead-status-banner'
import { LeadSourceStatusGrid } from '@/components/sales/lead-source-status-grid'
import { LeadStep3Placeholder } from '@/components/sales/lead-step3-placeholder'
import { LeadMasterRecord } from '@/components/sales/lead-master-record'
import type { MasterRecord, NormalizedContact } from '@/lib/services/sales-leads/types'

type PageProps = { params: Promise<{ run_id: string }> }
type OwnerConfig = {
  id: string
  hoofddomein_strategy: 'fixed' | 'auto_match_by_address'
  hoofddomein_fixed_value: string | null
}

export default function RunDetailPage({ params }: PageProps) {
  const { run_id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const { run, loading, error } = usePollingRun(run_id)

  const [master, setMaster] = useState<MasterRecord | null>(null)
  const [selected, setSelected] = useState<NormalizedContact[]>([])
  const [owners, setOwners] = useState<OwnerConfig[] | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Sync run → lokale state bij eerste review-load. Daarna laten we lokale state leiden
  // (anders overschrijft polling user-edits).
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!run) return
    if (run.status === 'enriching') return
    if (!hydratedRef.current) {
      setMaster(run.master_record ?? null)
      setSelected((run.selected_contacts ?? []) as NormalizedContact[])
      hydratedRef.current = true
    }
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
  useEffect(() => {
    if (!hydratedRef.current || !run || run.status !== 'review') return
    const payload = JSON.stringify({
      master_record: debouncedMaster,
      selected_contacts: debouncedSelected,
    })
    if (payload === lastSentRef.current) return
    lastSentRef.current = payload
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
      })
      .catch((e) =>
        toast({
          title: 'Auto-save mislukt',
          description: (e as Error).message,
          variant: 'destructive',
        }),
      )
  }, [debouncedMaster, debouncedSelected, run_id, run, toast])

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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <LeadStatusBanner run={run} onCancel={cancelling ? undefined : onCancel} />
      <LeadSourceStatusGrid enrichments={run.enrichments ?? {}} />
      {showEnriching && (
        <div className="rounded-md border border-dashed p-6 text-sm text-gray-500">
          Verrijking loopt — review verschijnt zodra de orchestrator klaar is.
        </div>
      )}
      {showReview && master && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <LeadMasterRecord
              master={master}
              enrichments={run.enrichments ?? {}}
              ownerConfig={ownerConfig}
              onChange={setMaster}
            />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-md border border-dashed p-6 text-sm text-gray-400">
              Contacten — komt in taak 5
            </div>
            <div className="rounded-md border border-dashed p-6 text-sm text-gray-400">
              Vacatures — komt in taak 6
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="rounded-md border border-dashed p-6 text-sm text-gray-400">
              Auto-notitie + warnings — komt in taak 6
            </div>
          </div>
        </div>
      )}
      {showStep3 && <LeadStep3Placeholder run={run} />}
      {!showReview && !showEnriching && !showStep3 && (
        <div className="rounded-md border border-dashed p-6 text-sm text-gray-500">
          Status: <span className="font-mono">{run.status}</span>
        </div>
      )}
    </div>
  )
}
