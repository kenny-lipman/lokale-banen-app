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

/**
 * True wanneer de run async werk uitvoert dat polling-updates oplevert:
 * - Volledige run-status='enriching' (volledige Promise.allSettled flow)
 * - Of: één enkele source heeft status='running' of 'pending' (per-source
 *   replay via /replay-source). Dan blijft run.status='review' maar de
 *   source-card moet wel polling krijgen voor live updates.
 */
function isRunActive(run: RunDetailResponse["run"] | null | undefined): boolean {
  if (!run) return false
  if (run.status === "enriching") return true
  const sources = run.enrichments ?? {}
  for (const key of ["kvk", "google_maps", "apollo", "website"] as const) {
    const s = sources[key]?.status
    if (s === "running" || s === "pending") return true
  }
  return false
}

export function usePollingRun(runId: string | null) {
  const [timedOut, setTimedOut] = useState(false)
  const startedAtRef = useRef<number>(Date.now())
  const lastRunIdRef = useRef<string | null>(null)
  const wasActiveRef = useRef<boolean>(false)

  // Reset start-tijd zodra er een nieuwe runId binnenkomt
  if (runId && lastRunIdRef.current !== runId) {
    startedAtRef.current = Date.now()
    lastRunIdRef.current = runId
    wasActiveRef.current = false
    if (timedOut) setTimedOut(false)
  }

  const { data, error, isLoading, mutate } = useSWR<RunDetailResponse["run"]>(
    runId ? swrKeys.salesLeadsRun(runId) : null,
    () => fetchSalesLeadsRun(runId as string),
    pollingOptions((latestData) => {
      if (timedOut) return 0
      if (!latestData) return POLL_MS
      if (!isRunActive(latestData)) return 0
      if (Date.now() - startedAtRef.current > MAX_DURATION_MS) return 0
      return POLL_MS
    }),
  )

  // Reset start-tijd bij transitie van 'idle' naar 'active' (bv. user klikt
  // "Opnieuw" op een source na 30 min idle review). Voorkomt dat de
  // MAX_DURATION-check meteen timedOut triggert op een verse replay.
  const isActiveNow = isRunActive(data ?? null)
  if (isActiveNow && !wasActiveRef.current) {
    startedAtRef.current = Date.now()
    if (timedOut) setTimedOut(false)
  }
  wasActiveRef.current = isActiveNow

  // Trigger timedOut wanneer we de duur overschrijden tijdens polling
  useEffect(() => {
    if (!runId) return
    if (!isRunActive(data ?? null)) return
    const remaining = MAX_DURATION_MS - (Date.now() - startedAtRef.current)
    if (remaining <= 0) {
      setTimedOut(true)
      return
    }
    const handle = setTimeout(() => setTimedOut(true), remaining)
    return () => clearTimeout(handle)
  }, [runId, data])

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
