"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { BackfillBatch, BackfillLead, BackfillBatchStatus } from '@/lib/services/instantly-backfill.service'

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
  pollingInterval: number // milliseconds
  enableLightweightPolling: boolean
  onStatusChange?: (status: BatchStatusResponse) => void
  onComplete?: (batchId: string, batch: BackfillBatch) => void
  onError?: (error: string) => void
}

const DEFAULT_CONFIG: BackfillPollingConfig = {
  pollingInterval: 3000, // 3 seconds
  enableLightweightPolling: true
}

export interface BackfillPollingState {
  isPolling: boolean
  batchStatus: BackfillBatch | null
  recentLeads: BackfillLead[]
  eta: { estimatedMinutesRemaining: number; leadsPerMinute: number } | null
  pollingPhase: 'active' | 'manual' | 'stopped'
  elapsedTime: number
  error: string | null
  canManualRefresh: boolean
  lastRefreshed: Date | null
}

export function useBackfillPolling(
  batchId: string | null,
  config: Partial<BackfillPollingConfig> = {}
) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }
  const { toast } = useToast()

  const [state, setState] = useState<BackfillPollingState>({
    isPolling: false,
    batchStatus: null,
    recentLeads: [],
    eta: null,
    pollingPhase: 'stopped',
    elapsedTime: 0,
    error: null,
    canManualRefresh: false,
    lastRefreshed: null
  })

  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<Date | null>(null)
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Fetch batch status
  const fetchBatchStatus = useCallback(async (isLightweight = false): Promise<BatchStatusResponse | null> => {
    if (!batchId) return null

    try {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()

      const url = `/api/instantly/backfill-queue/status/${batchId}${isLightweight ? '?lightweight=true' : ''}`
      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait before checking again.')
        }
        throw new Error(`Failed to fetch status: ${response.statusText}`)
      }

      const data: BatchStatusResponse = await response.json()

      if (!data.success) {
        throw new Error('Failed to fetch status')
      }

      setState(prev => ({
        ...prev,
        batchStatus: data.batch,
        recentLeads: data.recentLeads || prev.recentLeads,
        eta: data.eta || null,
        lastRefreshed: new Date(),
        error: null
      }))

      // Call status change callback
      if (fullConfig.onStatusChange) {
        fullConfig.onStatusChange(data)
      }

      return data

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null // Request was cancelled
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        lastRefreshed: new Date()
      }))

      if (fullConfig.onError) {
        fullConfig.onError(errorMessage)
      }

      return null
    }
  }, [batchId, fullConfig])

  // Stop polling
  const stopPolling = useCallback(() => {
    console.log('Stopping backfill polling')

    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    setState(prev => ({
      ...prev,
      isPolling: false,
      pollingPhase: 'stopped',
      canManualRefresh: false
    }))
  }, [])

  // Start polling
  const startPolling = useCallback(() => {
    if (!batchId || state.isPolling) return

    console.log(`Starting backfill polling for batch ${batchId}`)

    startTimeRef.current = new Date()

    setState(prev => ({
      ...prev,
      isPolling: true,
      pollingPhase: 'active',
      elapsedTime: 0,
      error: null
    }))

    // Start elapsed time counter
    elapsedTimerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current.getTime()
        setState(prev => ({ ...prev, elapsedTime: elapsed }))
      }
    }, 1000)

    // Initial fetch
    fetchBatchStatus(fullConfig.enableLightweightPolling)

    // Set up polling interval
    pollingRef.current = setInterval(async () => {
      const status = await fetchBatchStatus(fullConfig.enableLightweightPolling)

      if (!status) return

      // Check if batch is complete
      const completedStatuses: BackfillBatchStatus[] = ['completed', 'failed', 'cancelled']
      if (completedStatuses.includes(status.batch.status)) {
        stopPolling()

        if (fullConfig.onComplete) {
          fullConfig.onComplete(status.batch.batch_id, status.batch)
        }

        // Show completion toast
        const isSuccess = status.batch.status === 'completed'
        toast({
          title: isSuccess ? "Backfill Complete!" : `Backfill ${status.batch.status}`,
          description: isSuccess
            ? `Successfully synced ${status.batch.synced_leads} leads (${status.batch.skipped_leads} skipped, ${status.batch.failed_leads} failed)`
            : status.batch.last_error || `Backfill ${status.batch.status}`,
          variant: isSuccess ? 'default' : 'destructive'
        })

        return
      }

      // Polling continues until batch is complete/failed/cancelled
      // No timeout limit - user can manually stop if needed
    }, fullConfig.pollingInterval)

  }, [batchId, state.isPolling, fullConfig, fetchBatchStatus, stopPolling, toast])

  // Manual refresh
  const manualRefresh = useCallback(async () => {
    if (!state.canManualRefresh) return

    setState(prev => ({ ...prev, canManualRefresh: false }))

    try {
      const status = await fetchBatchStatus(false) // Use full status for manual refresh

      if (status) {
        const completedStatuses: BackfillBatchStatus[] = ['completed', 'failed', 'cancelled']
        if (completedStatuses.includes(status.batch.status)) {
          if (fullConfig.onComplete) {
            fullConfig.onComplete(status.batch.batch_id, status.batch)
          }
        }
      }
    } finally {
      // Re-enable manual refresh after a short delay
      setTimeout(() => {
        setState(prev => ({ ...prev, canManualRefresh: true }))
      }, 2000)
    }
  }, [state.canManualRefresh, fetchBatchStatus, fullConfig])

  // Format elapsed time
  const formatElapsedTime = useCallback((ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${remainingSeconds}s`
  }, [])

  // Get user-friendly status message
  const getStatusMessage = useCallback(() => {
    if (!state.batchStatus) return "Initializing..."

    const { status, synced_leads, skipped_leads, failed_leads, total_leads } = state.batchStatus
    const processed = synced_leads + skipped_leads + failed_leads

    switch (status) {
      case 'pending':
        return "Preparing backfill..."
      case 'collecting':
        return `Collecting leads from Instantly... (${total_leads} found)`
      case 'processing':
        if (state.pollingPhase === 'active') {
          const etaText = state.eta
            ? ` (~${state.eta.estimatedMinutesRemaining}m remaining)`
            : ''
          return `Processing... ${processed}/${total_leads} leads (${formatElapsedTime(state.elapsedTime)})${etaText}`
        } else {
          return `Still processing... ${processed}/${total_leads} leads. This may take a few minutes.`
        }
      case 'paused':
        return `Paused at ${processed}/${total_leads} leads`
      case 'completed':
        return `Complete! ${synced_leads} synced, ${skipped_leads} skipped, ${failed_leads} failed`
      case 'failed':
        return `Failed: ${state.batchStatus.last_error || 'Unknown error'}`
      case 'cancelled':
        return `Cancelled at ${processed}/${total_leads} leads`
      default:
        return "Unknown status"
    }
  }, [state.batchStatus, state.pollingPhase, state.elapsedTime, state.eta, formatElapsedTime])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  // Auto-start polling when batchId is provided
  useEffect(() => {
    if (batchId && !state.isPolling && state.pollingPhase === 'stopped') {
      startPolling()
    }
  }, [batchId, startPolling, state.isPolling, state.pollingPhase])

  return {
    ...state,
    startPolling,
    stopPolling,
    manualRefresh,
    getStatusMessage,
    formatElapsedTime: (ms: number) => formatElapsedTime(ms),
    progress: state.batchStatus ? {
      percentage: state.batchStatus.total_leads > 0
        ? Math.round(((state.batchStatus.synced_leads + state.batchStatus.skipped_leads + state.batchStatus.failed_leads) / state.batchStatus.total_leads) * 100)
        : 0,
      synced: state.batchStatus.synced_leads,
      skipped: state.batchStatus.skipped_leads,
      failed: state.batchStatus.failed_leads,
      total: state.batchStatus.total_leads
    } : null
  }
}
