"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { toast } from 'sonner'
import { swrKeys } from "@/lib/swr-keys"
import { pollingOptions } from "@/lib/swr-polling"

interface BatchStatusResponse {
  batch_id: string
  status: "pending" | "processing" | "completed" | "failed" | "partial_success"
  total_companies: number
  completed_companies: number
  failed_companies: number
  started_at: string
  completed_at: string | null
  error_message: string | null
  company_results: Array<{
    company_id: string
    status: string
    apollo_contacts_count: number | null
    enriched_at: string | null
  }>
}

interface EnrichmentPollingConfig {
  pollingInterval: number
  maxPollingDuration: number
  enableLightweightPolling: boolean
  onStatusChange?: (status: BatchStatusResponse) => void
  onCompanyUpdate?: (companyId: string, result: any) => void
  onComplete?: (batchId: string, results: BatchStatusResponse) => void
  onError?: (error: string) => void
}

const DEFAULT_CONFIG: EnrichmentPollingConfig = {
  pollingInterval: 3000,
  maxPollingDuration: 45000,
  enableLightweightPolling: true,
}

export interface EnrichmentPollingState {
  isPolling: boolean
  batchStatus: BatchStatusResponse | null
  pollingPhase: "active" | "manual" | "stopped"
  elapsedTime: number
  error: string | null
  canManualRefresh: boolean
  lastRefreshed: Date | null
}

const TERMINAL: BatchStatusResponse["status"][] = ["completed", "failed"]

async function fetchEnrichmentStatus(
  batchId: string,
  isLightweight: boolean,
): Promise<BatchStatusResponse> {
  const url = `/api/apollo/status/${batchId}${isLightweight ? "?lightweight=true" : ""}`
  const response = await fetch(url, { headers: { "Cache-Control": "no-cache" } })
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please wait before checking again.")
    }
    throw new Error(`Failed to fetch status: ${response.statusText}`)
  }
  return response.json()
}

function formatElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`
}

export function useEnrichmentPolling(
  batchId: string | null,
  config: Partial<EnrichmentPollingConfig> = {},
) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }
  const configRef = useRef(config)
  configRef.current = config
  const [enabled, setEnabled] = useState(true)
  const [phase, setPhase] = useState<"active" | "manual" | "stopped">("stopped")
  const [elapsedTime, setElapsedTime] = useState(0)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [canManualRefresh, setCanManualRefresh] = useState(false)

  const startTimeRef = useRef<number | null>(null)
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null)
  const notifiedTerminalRef = useRef<string | null>(null)
  const notifiedCompaniesRef = useRef<Set<string>>(new Set())
  const lastBatchIdRef = useRef<string | null>(null)

  // Reset bij nieuwe batchId
  if (batchId && lastBatchIdRef.current !== batchId) {
    lastBatchIdRef.current = batchId
    startTimeRef.current = Date.now()
    notifiedTerminalRef.current = null
    notifiedCompaniesRef.current = new Set()
    setEnabled(true)
    setPhase("active")
    setElapsedTime(0)
  }

  const isPolling = !!batchId && enabled && phase === "active"

  const refreshIntervalCb = useCallback(
    (latestData: BatchStatusResponse | undefined) => {
      if (!enabled) return 0
      if (latestData && TERMINAL.includes(latestData.status)) return 0
      if (
        startTimeRef.current &&
        Date.now() - startTimeRef.current >= fullConfig.maxPollingDuration
      ) {
        return 0
      }
      return fullConfig.pollingInterval
    },
    [enabled, fullConfig.maxPollingDuration, fullConfig.pollingInterval],
  )

  const { data, error, isLoading, mutate } = useSWR<BatchStatusResponse>(
    batchId && enabled ? swrKeys.enrichmentBatch(batchId) : null,
    () => fetchEnrichmentStatus(batchId as string, fullConfig.enableLightweightPolling),
    pollingOptions(refreshIntervalCb),
  )

  // Elapsed-time counter zolang we actief pollen
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

  // Track lastRefreshed bij elke fetch
  useEffect(() => {
    if (data || error) setLastRefreshed(new Date())
  }, [data, error])

  // Phase-overgangen + callbacks bij data-change
  useEffect(() => {
    if (!batchId || !data) return

    configRef.current.onStatusChange?.(data)

    if (configRef.current.onCompanyUpdate && data.company_results) {
      data.company_results.forEach((result) => {
        const seenKey = `${result.company_id}:${result.status}:${result.enriched_at ?? ""}`
        if (!notifiedCompaniesRef.current.has(seenKey)) {
          notifiedCompaniesRef.current.add(seenKey)
          configRef.current.onCompanyUpdate?.(result.company_id, result)
        }
      })
    }

    if (TERMINAL.includes(data.status)) {
      if (notifiedTerminalRef.current !== data.batch_id) {
        notifiedTerminalRef.current = data.batch_id
        setPhase("stopped")
        setCanManualRefresh(false)
        configRef.current.onComplete?.(data.batch_id, data)
        toast.success(data.status === "completed" ? "Enrichment Complete!" : "Enrichment Failed", {
          description: data.status === "completed"
              ? `Successfully enriched ${data.completed_companies} companies`
              : `Enrichment failed: ${data.error_message || "Unknown error"}`
        })
      }
      return
    }

    // Switch naar manual mode na maxPollingDuration
    if (
      phase === "active" &&
      startTimeRef.current &&
      Date.now() - startTimeRef.current >= fullConfig.maxPollingDuration
    ) {
      setPhase("manual")
      setCanManualRefresh(true)
      toast.success("Enrichment in Progress", {
        description: "Enrichment may take a few minutes. Use 'Check Status' to update manually."
      })
    }
  }, [data, batchId, fullConfig.maxPollingDuration, phase])

  // Error-callback
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
    notifiedCompaniesRef.current = new Set()
    startTimeRef.current = Date.now()
    setElapsedTime(0)
    setEnabled(true)
    setPhase("active")
  }, [batchId])

  const manualRefresh = useCallback(async () => {
    if (!canManualRefresh) return
    setCanManualRefresh(false)
    try {
      // Manual mode: gebruik full status (niet lightweight)
      const response = await fetch(`/api/apollo/status/${batchId}`, {
        headers: { "Cache-Control": "no-cache" },
      })
      if (response.ok) {
        const fresh = (await response.json()) as BatchStatusResponse
        await mutate(fresh, { revalidate: false })
      } else {
        await mutate()
      }
    } finally {
      setTimeout(() => setCanManualRefresh(true), 2000)
    }
  }, [batchId, canManualRefresh, mutate])

  const getStatusMessage = useCallback(() => {
    if (!data) return "Initializing..."
    const { status, completed_companies, total_companies, failed_companies } = data
    switch (status) {
      case "processing":
        if (phase === "active") {
          return `Enriching... ${completed_companies}/${total_companies} completed (${formatElapsed(elapsedTime)})`
        }
        return `Still processing... ${completed_companies}/${total_companies} completed. This may take a few minutes.`
      case "completed":
        return `✅ Complete! ${completed_companies} companies enriched successfully`
      case "failed":
        return `❌ Failed: ${data.error_message || "Unknown error"}`
      case "partial_success":
        return `⚠️ Partial success: ${completed_companies} succeeded, ${failed_companies} failed`
      default:
        return "Pending..."
    }
  }, [data, phase, elapsedTime])

  const progress = useMemo(
    () =>
      data
        ? {
            percentage:
              data.total_companies > 0
                ? Math.round(
                    ((data.completed_companies + data.failed_companies) / data.total_companies) *
                      100,
                  )
                : 0,
            completed: data.completed_companies,
            failed: data.failed_companies,
            total: data.total_companies,
          }
        : null,
    [data],
  )

  return {
    isPolling,
    batchStatus: data ?? null,
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
    // Niet meer gebruikt extern, maar bewaard voor compat:
    loading: isLoading,
  }
}
