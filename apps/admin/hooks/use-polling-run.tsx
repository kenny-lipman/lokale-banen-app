'use client'

import { useEffect, useRef, useState } from 'react'
import type { RunDetailResponse } from '@/lib/services/sales-leads/types'

type PollingState = {
  run: RunDetailResponse['run'] | null
  loading: boolean
  error: string | null
}

const POLL_MS = 1500
const MAX_DURATION_MS = 5 * 60 * 1000 // matcht maxDuration=300 op orchestrator

export function usePollingRun(runId: string | null) {
  const [state, setState] = useState<PollingState>({
    run: null,
    loading: true,
    error: null,
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef<number>(Date.now())

  async function fetchOnce(id: string) {
    try {
      const res = await fetch(`/api/sales-leads/${id}`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const json = (await res.json()) as RunDetailResponse
      setState({ run: json.run, loading: false, error: null })
      return json.run
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }))
      return null
    }
  }

  function stop() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    stop()
    if (!runId) {
      setState({ run: null, loading: false, error: null })
      return
    }
    startedAtRef.current = Date.now()
    void fetchOnce(runId).then((run) => {
      if (!run || run.status !== 'enriching') return
      timerRef.current = setInterval(async () => {
        const r = await fetchOnce(runId)
        if (!r) return stop()
        if (r.status !== 'enriching') return stop()
        if (Date.now() - startedAtRef.current > MAX_DURATION_MS) return stop()
      }, POLL_MS)
    })
    return stop
  }, [runId])

  async function refetch() {
    if (!runId) return null
    return fetchOnce(runId)
  }

  return { ...state, refetch }
}
