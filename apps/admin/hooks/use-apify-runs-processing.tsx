'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { toast } from '@/hooks/use-toast'
import { ProcessingStatusType } from '@/components/ProcessingStatus'
import { ApifyRun } from '@/components/RunListView'
import { StatusFilter, calculateStatusCounts } from '@/components/StatusFilterPills'

interface UseApifyRunsProcessingProps {
  initialRuns: ApifyRun[]
}

export function useApifyRunsProcessing({ initialRuns }: UseApifyRunsProcessingProps) {
  const [runs, setRuns] = useState<ApifyRun[]>(initialRuns)
  const [selectedRuns, setSelectedRuns] = useState<string[]>([])
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all')
  const [isLoading, setIsLoading] = useState(false)

  // Sync with initialRuns when they change, but preserve any local updates
  React.useEffect(() => {
    setRuns(prevRuns => {
      // If there are no previous runs, just use initial runs
      if (prevRuns.length === 0) {
        return initialRuns
      }
      
      // Merge initial runs with any local updates
      return initialRuns.map(initialRun => {
        const existingRun = prevRuns.find(r => r.id === initialRun.id)
        // Keep local updates for processing fields, use initial data for other fields
        return existingRun ? {
          ...initialRun,
          processing_status: existingRun.processing_status,
          processing_notes: existingRun.processing_notes,
          processed_at: existingRun.processed_at,
          processed_by: existingRun.processed_by
        } : initialRun
      })
    })
  }, [initialRuns])

  // Optimistically update a single run's status
  const updateRunStatusOptimistic = useCallback((runId: string, status: ProcessingStatusType) => {
    setRuns(prevRuns => 
      prevRuns.map(run => 
        run.id === runId 
          ? { 
              ...run, 
              processing_status: status,
              processed_at: new Date().toISOString() 
            }
          : run
      )
    )
  }, [])

  // Optimistically update a single run's notes
  const updateRunNotesOptimistic = useCallback((runId: string, notes: string) => {
    setRuns(prevRuns => 
      prevRuns.map(run => 
        run.id === runId 
          ? { 
              ...run, 
              processing_notes: notes,
              processed_at: new Date().toISOString() 
            }
          : run
      )
    )
  }, [])

  // API call to update single run status
  const updateRunStatus = useCallback(async (runId: string, status: ProcessingStatusType) => {
    // Optimistic update
    updateRunStatusOptimistic(runId, status)

    try {
      const response = await fetch(`/api/otis/runs/${runId}/processing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ processing_status: status })
      })

      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update status')
      }

      // Update with actual server response
      setRuns(prevRuns => 
        prevRuns.map(run => 
          run.id === runId 
            ? { ...run, ...result.run }
            : run
        )
      )

      toast({
        title: 'Status Updated',
        description: `Run marked as ${status.replace('_', ' ')}`,
      })

    } catch (error) {
      // Revert optimistic update on error
      const originalRun = initialRuns.find(run => run.id === runId)
      if (originalRun) {
        setRuns(prevRuns => 
          prevRuns.map(run => 
            run.id === runId ? originalRun : run
          )
        )
      }

      console.error('Failed to update run status:', error)
      toast({
        title: 'Error',
        description: 'Failed to update run status. Please try again.',
        variant: 'destructive'
      })
      throw error
    }
  }, [initialRuns, updateRunStatusOptimistic])

  // API call to update single run notes
  const updateRunNotes = useCallback(async (runId: string, notes: string) => {
    // Optimistic update
    updateRunNotesOptimistic(runId, notes)

    try {
      const response = await fetch(`/api/otis/runs/${runId}/processing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ processing_notes: notes })
      })

      if (!response.ok) {
        throw new Error(`Failed to update notes: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update notes')
      }

      // Update with actual server response
      setRuns(prevRuns => 
        prevRuns.map(run => 
          run.id === runId 
            ? { ...run, ...result.run }
            : run
        )
      )

    } catch (error) {
      // Revert optimistic update on error
      const originalRun = initialRuns.find(run => run.id === runId)
      if (originalRun) {
        setRuns(prevRuns => 
          prevRuns.map(run => 
            run.id === runId ? originalRun : run
          )
        )
      }

      console.error('Failed to update run notes:', error)
      toast({
        title: 'Error',
        description: 'Failed to update notes. Please try again.',
        variant: 'destructive'
      })
      throw error
    }
  }, [initialRuns, updateRunNotesOptimistic])

  // Bulk status update
  const updateBulkStatus = useCallback(async (runIds: string[], status: ProcessingStatusType) => {
    if (runIds.length === 0) return

    setIsLoading(true)

    // Optimistic update
    setRuns(prevRuns => 
      prevRuns.map(run => 
        runIds.includes(run.id)
          ? { 
              ...run, 
              processing_status: status,
              processed_at: new Date().toISOString() 
            }
          : run
      )
    )

    try {
      const response = await fetch('/api/otis/runs/bulk-processing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          runIds, 
          processing_status: status 
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to bulk update: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to bulk update')
      }

      toast({
        title: 'Bulk Update Complete',
        description: `${result.updated} runs updated to ${status.replace('_', ' ')}`,
      })

      // Clear selection after successful bulk update
      setSelectedRuns([])

    } catch (error) {
      // Revert optimistic update on error
      setRuns(prevRuns => 
        prevRuns.map(run => {
          const originalRun = initialRuns.find(r => r.id === run.id)
          return runIds.includes(run.id) && originalRun ? originalRun : run
        })
      )

      console.error('Failed to bulk update runs:', error)
      toast({
        title: 'Error',
        description: 'Failed to update runs. Please try again.',
        variant: 'destructive'
      })
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [initialRuns])

  // Filter runs based on active filter
  const filteredRuns = useMemo(() => {
    if (activeFilter === 'all') return runs
    return runs.filter(run => run.processing_status === activeFilter)
  }, [runs, activeFilter])

  // Calculate status counts
  const statusCounts = useMemo(() => calculateStatusCounts(runs), [runs])

  // Selection handlers
  const handleSelectionChange = useCallback((runIds: string[]) => {
    setSelectedRuns(runIds)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedRuns([])
  }, [])

  const selectAll = useCallback(() => {
    setSelectedRuns(filteredRuns.map(run => run.id))
  }, [filteredRuns])

  return {
    // Data
    runs: filteredRuns,
    allRuns: runs,
    selectedRuns,
    statusCounts,
    
    // State
    activeFilter,
    isLoading,
    
    // Actions
    setActiveFilter,
    updateRunStatus,
    updateRunNotes,
    updateBulkStatus,
    handleSelectionChange,
    clearSelection,
    selectAll,
    
    // Refresh data - don't override local processing updates
    refreshRuns: () => {
      // This will be handled by the useEffect above
    }
  }
}