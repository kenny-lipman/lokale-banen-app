"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import useSWR from "swr"
import type { RunDetailResponse } from "@/lib/services/sales-leads/types"
import { swrKeys } from "@/lib/swr-keys"
import { pollingOptions } from "@/lib/swr-polling"

const POLL_MS = 1500
const MAX_DURATION_MS = 5 * 60 * 1000 // matcht maxDuration=300 op orchestrator

async function fetchSalesLeadsRun(runId: string): Promise<RunDetailResponse["run"]> {
  const res = await fetch(`/api/sales-leads/${runId}`, { cache: "no-store" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  const json = (await res.json()) as RunDetailResponse
  return json.run
}

export function usePollingRun(runId: string | null) {
  const [timedOut, setTimedOut] = useState(false)
  const startedAtRef = useRef<number>(Date.now())
  const lastRunIdRef = useRef<string | null>(null)

  // Reset start-tijd zodra er een nieuwe runId binnenkomt
  if (runId && lastRunIdRef.current !== runId) {
    startedAtRef.current = Date.now()
    lastRunIdRef.current = runId
    if (timedOut) setTimedOut(false)
  }

  const { data, error, isLoading, mutate } = useSWR<RunDetailResponse["run"]>(
    runId ? swrKeys.salesLeadsRun(runId) : null,
    () => fetchSalesLeadsRun(runId as string),
    pollingOptions((latestData) => {
      if (timedOut) return 0
      if (!latestData) return POLL_MS
      if (latestData.status !== "enriching") return 0
      if (Date.now() - startedAtRef.current > MAX_DURATION_MS) return 0
      return POLL_MS
    }),
  )

  // Trigger timedOut wanneer we de duur overschrijden tijdens polling
  useEffect(() => {
    if (!runId) return
    if (data?.status !== "enriching") return
    const remaining = MAX_DURATION_MS - (Date.now() - startedAtRef.current)
    if (remaining <= 0) {
      setTimedOut(true)
      return
    }
    const handle = setTimeout(() => setTimedOut(true), remaining)
    return () => clearTimeout(handle)
  }, [runId, data?.status])

  const refetch = useCallback(async () => {
    if (!runId) return null
    setTimedOut(false)
    startedAtRef.current = Date.now()
    const result = await mutate()
    return result ?? null
  }, [runId, mutate])

  return {
    run: data ?? null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    timedOut,
    refetch,
  }
}
