"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'

interface BatchStatusResponse {
  batch_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial_success'
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
  pollingInterval: number // milliseconds
  maxPollingDuration: number // milliseconds
  enableLightweightPolling: boolean
  onStatusChange?: (status: BatchStatusResponse) => void
  onCompanyUpdate?: (companyId: string, result: any) => void
  onComplete?: (batchId: string, results: BatchStatusResponse) => void
  onError?: (error: string) => void
}

const DEFAULT_CONFIG: EnrichmentPollingConfig = {
  pollingInterval: 3000, // 3 seconds
  maxPollingDuration: 45000, // 45 seconds
  enableLightweightPolling: true
}

export interface EnrichmentPollingState {
  isPolling: boolean
  batchStatus: BatchStatusResponse | null
  pollingPhase: 'active' | 'manual' | 'stopped'
  elapsedTime: number
  error: string | null
  canManualRefresh: boolean
  lastRefreshed: Date | null
}

export function useEnrichmentPolling(
  batchId: string | null, 
  config: Partial<EnrichmentPollingConfig> = {}
) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }
  const { toast } = useToast()
  
  const [state, setState] = useState<EnrichmentPollingState>({
    isPolling: false,
    batchStatus: null,
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
  const fetchBatchStatus = useCallback(async (isLightweight = false) => {
    if (!batchId) return null

    try {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      abortControllerRef.current = new AbortController()
      
      const url = `/api/apollo/status/${batchId}${isLightweight ? '?lightweight=true' : ''}`
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
      
      setState(prev => ({
        ...prev,
        batchStatus: data,
        lastRefreshed: new Date(),
        error: null
      }))

      // Call status change callback
      if (fullConfig.onStatusChange) {
        fullConfig.onStatusChange(data)
      }

      // Call company update callbacks
      if (fullConfig.onCompanyUpdate && data.company_results) {
        data.company_results.forEach(result => {
          fullConfig.onCompanyUpdate!(result.company_id, result)
        })
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

  // Start polling
  const startPolling = useCallback(() => {
    if (!batchId || state.isPolling) return

    console.log(`🔄 Starting enrichment polling for batch ${batchId}`)
    
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

      // Check if enrichment is complete
      if (status.status === 'completed' || status.status === 'failed') {
        stopPolling()
        
        if (fullConfig.onComplete) {
          fullConfig.onComplete(status.batch_id, status)
        }

        // Show completion toast
        toast({
          title: status.status === 'completed' ? "Enrichment Complete!" : "Enrichment Failed",
          description: status.status === 'completed' 
            ? `Successfully enriched ${status.completed_companies} companies`
            : `Enrichment failed: ${status.error_message || 'Unknown error'}`,
          variant: status.status === 'completed' ? 'default' : 'destructive'
        })
        
        return
      }

      // Check if we've reached max polling duration
      if (startTimeRef.current && 
          Date.now() - startTimeRef.current.getTime() >= fullConfig.maxPollingDuration) {
        
        console.log('⏱️ Max polling duration reached, switching to manual mode')
        
        // Switch to manual mode
        setState(prev => ({
          ...prev,
          pollingPhase: 'manual',
          canManualRefresh: true
        }))
        
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }

        toast({
          title: "Enrichment in Progress",
          description: "Enrichment may take a few minutes. Use 'Check Status' to update manually.",
          variant: 'default'
        })
      }
    }, fullConfig.pollingInterval)

  }, [batchId, state.isPolling, fullConfig, fetchBatchStatus, toast])

  // Stop polling
  const stopPolling = useCallback(() => {
    console.log('⏹️ Stopping enrichment polling')
    
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

  // Manual refresh
  const manualRefresh = useCallback(async () => {
    if (!state.canManualRefresh) return

    setState(prev => ({ ...prev, canManualRefresh: false }))
    
    try {
      const status = await fetchBatchStatus(false) // Use full status for manual refresh
      
      if (status && (status.status === 'completed' || status.status === 'failed')) {
        if (fullConfig.onComplete) {
          fullConfig.onComplete(status.batch_id, status)
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
    
    const { status, completed_companies, total_companies, failed_companies } = state.batchStatus
    
    switch (status) {
      case 'processing':
        if (state.pollingPhase === 'active') {
          return `Enriching... ${completed_companies}/${total_companies} completed (${formatElapsedTime(state.elapsedTime)})`
        } else {
          return `Still processing... ${completed_companies}/${total_companies} completed. This may take a few minutes.`
        }
      case 'completed':
        return `✅ Complete! ${completed_companies} companies enriched successfully`
      case 'failed':
        return `❌ Failed: ${state.batchStatus.error_message || 'Unknown error'}`
      case 'partial_success':
        return `⚠️ Partial success: ${completed_companies} succeeded, ${failed_companies} failed`
      default:
        return "Pending..."
    }
  }, [state.batchStatus, state.pollingPhase, state.elapsedTime, formatElapsedTime])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  // Auto-start polling when batchId is provided
  useEffect(() => {
    if (batchId && !state.isPolling) {
      startPolling()
    }
  }, [batchId, startPolling])

  return {
    ...state,
    startPolling,
    stopPolling,
    manualRefresh,
    getStatusMessage,
    formatElapsedTime: (ms: number) => formatElapsedTime(ms),
    progress: state.batchStatus ? {
      percentage: state.batchStatus.total_companies > 0 
        ? Math.round(((state.batchStatus.completed_companies + state.batchStatus.failed_companies) / state.batchStatus.total_companies) * 100)
        : 0,
      completed: state.batchStatus.completed_companies,
      failed: state.batchStatus.failed_companies,
      total: state.batchStatus.total_companies
    } : null
  }
}