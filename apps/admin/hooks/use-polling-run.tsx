'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RunDetailResponse } from '@/lib/services/sales-leads/types'

type PollingState = {
  run: RunDetailResponse['run'] | null
  loading: boolean
  error: string | null
  timedOut: boolean
}

const POLL_MS = 1500
const MAX_DURATION_MS = 5 * 60 * 1000 // matcht maxDuration=300 op orchestrator

export function usePollingRun(runId: string | null) {
  const [state, setState] = useState<PollingState>({
    run: null,
    loading: true,
    error: null,
    timedOut: false,
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef<number>(Date.now())
  const mountedRef = useRef<boolean>(true)
  const currentRunIdRef = useRef<string | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const fetchOnce = useCallback(async (id: string) => {
    try {
      const res = await authFetch(`/api/sales-leads/${id}`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const json = (await res.json()) as RunDetailResponse
      if (!mountedRef.current || currentRunIdRef.current !== id) return null
      setState((s) => ({ ...s, run: json.run, loading: false, error: null }))
      return json.run
    } catch (e) {
      if (!mountedRef.current || currentRunIdRef.current !== id) return null
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }))
      return null
    }
  }, [])

  // Mount/unmount tracking
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    stop()
    currentRunIdRef.current = runId
    if (!runId) {
      setState({ run: null, loading: false, error: null, timedOut: false })
      return
    }
    startedAtRef.current = Date.now()
    setState((s) => ({ ...s, timedOut: false }))
    void fetchOnce(runId).then((run) => {
      if (currentRunIdRef.current !== runId) return
      if (!run || run.status !== 'enriching') return
      timerRef.current = setInterval(async () => {
        if (currentRunIdRef.current !== runId) return stop()
        const r = await fetchOnce(runId)
        if (currentRunIdRef.current !== runId) return stop()
        if (!r) return stop()
        if (r.status !== 'enriching') return stop()
        if (Date.now() - startedAtRef.current > MAX_DURATION_MS) {
          if (mountedRef.current) setState((s) => ({ ...s, timedOut: true }))
          return stop()
        }
      }, POLL_MS)
    })
    return () => {
      stop()
    }
  }, [runId, stop, fetchOnce])

  const refetch = useCallback(async () => {
    if (!runId) return null
    if (mountedRef.current) setState((s) => ({ ...s, timedOut: false }))
    return fetchOnce(runId)
  }, [runId, fetchOnce])

  return { ...state, refetch }
}
