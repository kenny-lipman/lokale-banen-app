"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { toast } from 'sonner'
import type {
  BackfillBatch,
  BackfillLead,
  BackfillBatchStatus,
} from "@/lib/services/instantly-backfill.service"
import { swrKeys } from "@/lib/swr-keys"
import { pollingOptions } from "@/lib/swr-polling"

interface BatchStatusResponse {
  success: boolean
  batch: BackfillBatch
  recentLeads?: BackfillLead[]
  eta?: {
    estimatedMinutesRemaining: number
    leadsPerMinute: number
  }
}

interface BackfillPollingConfig {
  pollingInterval: number
  enableLightweightPolling: boolean
  onStatusChange?: (status: BatchStatusResponse) => void
  onComplete?: (batchId: string, batch: BackfillBatch) => void
  onError?: (error: string) => void
}

const DEFAULT_CONFIG: BackfillPollingConfig = {
  pollingInterval: 3000,
  enableLightweightPolling: true,
}

const TERMINAL: BackfillBatchStatus[] = ["completed", "failed", "cancelled"]

export interface BackfillPollingState {
  isPolling: boolean
  batchStatus: BackfillBatch | null
  recentLeads: BackfillLead[]
  eta: { estimatedMinutesRemaining: number; leadsPerMinute: number } | null
  pollingPhase: "active" | "manual" | "stopped"
  elapsedTime: number
  error: string | null
  canManualRefresh: boolean
  lastRefreshed: Date | null
}

async function fetchBackfillStatus(
  batchId: string,
  isLightweight: boolean,
): Promise<BatchStatusResponse> {
  const url = `/api/instantly/backfill-queue/status/${batchId}${isLightweight ? "?lightweight=true" : ""}`
  const response = await fetch(url, { headers: { "Cache-Control": "no-cache" } })
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please wait before checking again.")
    }
    throw new Error(`Failed to fetch status: ${response.statusText}`)
  }
  const data: BatchStatusResponse = await response.json()
  if (!data.success) {
    throw new Error("Failed to fetch status")
  }
  return data
}

function formatElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`
}

export function useBackfillPolling(
  batchId: string | null,
  config: Partial<BackfillPollingConfig> = {},
) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }
  const configRef = useRef(config)
  configRef.current = config
  const [enabled, setEnabled] = useState(true)
  const [phase, setPhase] = useState<"active" | "manual" | "stopped">("stopped")
  const [elapsedTime, setElapsedTime] = useState(0)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [canManualRefresh, setCanManualRefresh] = useState(false)
  const [recentLeadsState, setRecentLeadsState] = useState<BackfillLead[]>([])

  const startTimeRef = useRef<number | null>(null)
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null)
  const notifiedTerminalRef = useRef<string | null>(null)
  const lastBatchIdRef = useRef<string | null>(null)

  // Reset bij nieuwe batchId
  if (batchId && lastBatchIdRef.current !== batchId) {
    lastBatchIdRef.current = batchId
    startTimeRef.current = Date.now()
    notifiedTerminalRef.current = null
    setEnabled(true)
    setPhase("active")
    setElapsedTime(0)
    setRecentLeadsState([])
  }

  const isPolling = !!batchId && enabled && phase === "active"

  const refreshIntervalCb = useCallback(
    (latestData: BatchStatusResponse | undefined) => {
      if (!enabled) return 0
      if (latestData && TERMINAL.includes(latestData.batch.status)) return 0
      return fullConfig.pollingInterval
    },
    [enabled, fullConfig.pollingInterval],
  )

  const { data, error, isLoading, mutate } = useSWR<BatchStatusResponse>(
    batchId && enabled ? swrKeys.backfillBatch(batchId) : null,
    () => fetchBackfillStatus(batchId as string, fullConfig.enableLightweightPolling),
    pollingOptions(refreshIntervalCb),
  )

  // Bewaar laatst-bekende recentLeads (lightweight payloads kunnen ze weglaten)
  useEffect(() => {
    if (data?.recentLeads && data.recentLeads.length > 0) {
      setRecentLeadsState(data.recentLeads)
    }
  }, [data])

  // Elapsed-time timer
  useEffect(() => {
    if (!isPolling) {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current)
        elapsedTimerRef.current = null
      }
      return
    }
    if (!startTimeRef.current) startTimeRef.current = Date.now()
    elapsedTimerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedTime(Date.now() - startTimeRef.current)
      }
    }, 1000)
    return () => {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current)
        elapsedTimerRef.current = null
      }
    }
  }, [isPolling])

  // lastRefreshed bij elke fetch
  useEffect(() => {
    if (data || error) setLastRefreshed(new Date())
  }, [data, error])

  // Status callbacks + completion-toast bij terminal-overgang
  useEffect(() => {
    if (!batchId || !data) return
    configRef.current.onStatusChange?.(data)

    if (TERMINAL.includes(data.batch.status)) {
      if (notifiedTerminalRef.current !== data.batch.batch_id) {
        notifiedTerminalRef.current = data.batch.batch_id
        setPhase("stopped")
        setCanManualRefresh(false)
        configRef.current.onComplete?.(data.batch.batch_id, data.batch)

        const isSuccess = data.batch.status === "completed"
        toast.success(isSuccess ? "Backfill Complete!" : `Backfill ${data.batch.status}`, {
          description: isSuccess
            ? `Successfully synced ${data.batch.synced_leads} leads (${data.batch.skipped_leads} skipped, ${data.batch.failed_leads} failed)`
            : data.batch.last_error || `Backfill ${data.batch.status}`
        })
      }
    }
  }, [data, batchId])

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      configRef.current.onError?.(errorMessage)
    }
  }, [error])

  const stopPolling = useCallback(() => {
    setEnabled(false)
    setPhase("stopped")
    setCanManualRefresh(false)
  }, [])

  const startPolling = useCallback(() => {
    if (!batchId) return
    notifiedTerminalRef.current = null
    startTimeRef.current = Date.now()
    setElapsedTime(0)
    setEnabled(true)
    setPhase("active")
  }, [batchId])

  const manualRefresh = useCallback(async () => {
    if (!canManualRefresh) return
    setCanManualRefresh(false)
    try {
      const response = await fetch(`/api/instantly/backfill-queue/status/${batchId}`, {
        headers: { "Cache-Control": "no-cache" },
      })
      if (response.ok) {
        const fresh = (await response.json()) as BatchStatusResponse
        if (fresh.success) {
          await mutate(fresh, { revalidate: false })
          if (TERMINAL.includes(fresh.batch.status)) {
            configRef.current.onComplete?.(fresh.batch.batch_id, fresh.batch)
          }
        }
      } else {
        await mutate()
      }
    } finally {
      setTimeout(() => setCanManualRefresh(true), 2000)
    }
  }, [batchId, canManualRefresh, mutate])

  const getStatusMessage = useCallback(() => {
    if (!data?.batch) return "Initializing..."
    const { status, synced_leads, skipped_leads, failed_leads, total_leads } = data.batch
    const processed = synced_leads + skipped_leads + failed_leads

    switch (status) {
      case "pending":
        return "Preparing backfill..."
      case "collecting":
        return `Collecting leads from Instantly... (${total_leads} found)`
      case "processing":
        if (phase === "active") {
          const etaText = data.eta
            ? ` (~${data.eta.estimatedMinutesRemaining}m remaining)`
            : ""
          return `Processing... ${processed}/${total_leads} leads (${formatElapsed(elapsedTime)})${etaText}`
        }
        return `Still processing... ${processed}/${total_leads} leads. This may take a few minutes.`
      case "paused":
        return `Paused at ${processed}/${total_leads} leads`
      case "completed":
        return `Complete! ${synced_leads} synced, ${skipped_leads} skipped, ${failed_leads} failed`
      case "failed":
        return `Failed: ${data.batch.last_error || "Unknown error"}`
      case "cancelled":
        return `Cancelled at ${processed}/${total_leads} leads`
      default:
        return "Unknown status"
    }
  }, [data, phase, elapsedTime])

  const progress = useMemo(
    () =>
      data?.batch
        ? {
            percentage:
              data.batch.total_leads > 0
                ? Math.round(
                    ((data.batch.synced_leads +
                      data.batch.skipped_leads +
                      data.batch.failed_leads) /
                      data.batch.total_leads) *
                      100,
                  )
                : 0,
            synced: data.batch.synced_leads,
            skipped: data.batch.skipped_leads,
            failed: data.batch.failed_leads,
            total: data.batch.total_leads,
          }
        : null,
    [data],
  )

  return {
    isPolling,
    batchStatus: data?.batch ?? null,
    recentLeads: data?.recentLeads ?? recentLeadsState,
    eta: data?.eta ?? null,
    pollingPhase: phase,
    elapsedTime,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    canManualRefresh,
    lastRefreshed,
    startPolling,
    stopPolling,
    manualRefresh,
    getStatusMessage,
    formatElapsedTime: formatElapsed,
    progress,
    loading: isLoading,
  }
}
