// apps/admin/app/automatiseringen/[id]/run-now-button.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RunNowButton({ automationId }: { automationId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function trigger() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/automations/${automationId}/trigger`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }
      setPolling(true)
      const start = Date.now()
      const poll = async () => {
        if (Date.now() - start > 6 * 60_000) {
          setPolling(false); router.refresh(); return
        }
        const detail = await fetch(`/api/automations/${automationId}?days=1`).then(r => r.json())
        const stillRunning = (detail.runs ?? []).some((r: { status: string }) => r.status === 'running')
        if (!stillRunning) {
          setPolling(false); router.refresh(); return
        }
        setTimeout(poll, 2000)
      }
      setTimeout(poll, 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={trigger}
        disabled={loading || polling}
        className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {polling ? 'Bezig met draaien…' : loading ? 'Triggeren…' : 'Run Now'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
