'use client'

import { use, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePollingRun } from '@/hooks/use-polling-run'
import { LeadStatusBanner } from '@/components/sales/lead-status-banner'
import { LeadSourceStatusGrid } from '@/components/sales/lead-source-status-grid'
import { LeadStep3Placeholder } from '@/components/sales/lead-step3-placeholder'
import { useToast } from '@/hooks/use-toast'

type PageProps = { params: Promise<{ run_id: string }> }

export default function RunDetailPage({ params }: PageProps) {
  const { run_id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const { run, loading, error } = usePollingRun(run_id)
  const [cancelling, setCancelling] = useState(false)

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

  if (loading && !run) {
    return <div className="p-8 text-sm text-gray-500">Laden…</div>
  }
  if (error && !run) {
    return <div className="p-8 text-sm text-red-600">{error}</div>
  }
  if (!run) {
    return <div className="p-8 text-sm text-gray-500">Run niet gevonden.</div>
  }

  const showReview = run.status === 'review' || run.status === 'enriching'
  const showStep3 = run.status === 'syncing' || run.status === 'completed' || run.status === 'failed' || run.status === 'duplicate'

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <LeadStatusBanner run={run} onCancel={cancelling ? undefined : onCancel} />
      <LeadSourceStatusGrid enrichments={run.enrichments ?? {}} />
      {showReview && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <div className="rounded-md border border-dashed p-6 text-sm text-gray-400">Master record — komt in taak 4</div>
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-md border border-dashed p-6 text-sm text-gray-400">Contacten — komt in taak 5</div>
            <div className="rounded-md border border-dashed p-6 text-sm text-gray-400">Vacatures — komt in taak 6</div>
          </div>
          <div className="lg:col-span-5">
            <div className="rounded-md border border-dashed p-6 text-sm text-gray-400">Auto-notitie + warnings — komt in taak 6</div>
          </div>
        </div>
      )}
      {showStep3 && <LeadStep3Placeholder run={run} />}
    </div>
  )
}
