"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useBackfillPolling } from "@/hooks/use-backfill-polling"
import { BackfillProgress } from "./backfill-progress"
import { BackfillControls } from "./backfill-controls"
import { BackfillLeadsTable } from "./backfill-leads-table"
import { BackfillActivityLog } from "./backfill-activity-log"
import { BackfillHistory } from "./backfill-history"
import { Play, History } from "lucide-react"
import type { BackfillBatch } from "@/lib/services/instantly-backfill.service"

export function BackfillTab() {
  const { toast } = useToast()
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("current")

  // Polling hook
  const {
    batchStatus,
    recentLeads,
    eta,
    progress,
    isPolling,
    pollingPhase,
    elapsedTime,
    error,
    canManualRefresh,
    startPolling,
    stopPolling,
    manualRefresh,
    getStatusMessage,
  } = useBackfillPolling(currentBatchId, {
    pollingInterval: 3000,
    onComplete: (batchId, batch) => {
      toast({
        title: batch.status === 'completed' ? "Backfill voltooid!" : `Backfill ${batch.status}`,
        description: batch.status === 'completed'
          ? `${batch.synced_leads} leads gesynchroniseerd, ${batch.skipped_leads} overgeslagen, ${batch.failed_leads} mislukt`
          : batch.last_error || undefined,
        variant: batch.status === 'completed' ? 'default' : 'destructive',
      })
    },
  })

  // Load the most recent batch on mount
  useEffect(() => {
    const loadRecentBatch = async () => {
      try {
        const response = await fetch('/api/instantly/backfill-queue?limit=1')
        const data = await response.json()

        if (data.success && data.batches.length > 0) {
          const batch = data.batches[0] as BackfillBatch
          // Only set as current if it's active or recent (within last hour)
          const isRecent = new Date(batch.created_at).getTime() > Date.now() - 60 * 60 * 1000
          const isActive = ['pending', 'collecting', 'processing', 'paused'].includes(batch.status)

          if (isActive || isRecent) {
            setCurrentBatchId(batch.batch_id)
          }
        }
      } catch (error) {
        console.error('Failed to load recent batch:', error)
      } finally {
        setInitialLoading(false)
      }
    }

    loadRecentBatch()
  }, [])

  // Start backfill
  const handleStart = async (options: { dryRun?: boolean; batchSize?: number; maxLeadsToCollect?: number }) => {
    try {
      const response = await fetch('/api/instantly/backfill-queue/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      })

      const data = await response.json()

      if (data.success) {
        setCurrentBatchId(data.batchId)
        toast({
          title: "Backfill gestart",
          description: "Leads worden verzameld uit Instantly...",
        })
      } else {
        throw new Error(data.error || 'Failed to start backfill')
      }
    } catch (error) {
      toast({
        title: "Fout",
        description: error instanceof Error ? error.message : 'Failed to start backfill',
        variant: 'destructive',
      })
    }
  }

  // Pause backfill
  const handlePause = async () => {
    if (!currentBatchId) return

    try {
      const response = await fetch(`/api/instantly/backfill-queue/${currentBatchId}/pause`, {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Backfill gepauzeerd",
          description: "De backfill is gepauzeerd. Je kunt deze later hervatten.",
        })
        stopPolling()
      } else {
        throw new Error(data.error || 'Failed to pause backfill')
      }
    } catch (error) {
      toast({
        title: "Fout",
        description: error instanceof Error ? error.message : 'Failed to pause backfill',
        variant: 'destructive',
      })
    }
  }

  // Resume backfill
  const handleResume = async () => {
    if (!currentBatchId) return

    try {
      const response = await fetch(`/api/instantly/backfill-queue/${currentBatchId}/resume`, {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Backfill hervat",
          description: "De backfill gaat verder met verwerken.",
        })
        startPolling()
      } else {
        throw new Error(data.error || 'Failed to resume backfill')
      }
    } catch (error) {
      toast({
        title: "Fout",
        description: error instanceof Error ? error.message : 'Failed to resume backfill',
        variant: 'destructive',
      })
    }
  }

  // Cancel backfill
  const handleCancel = async () => {
    if (!currentBatchId) return

    try {
      const response = await fetch(`/api/instantly/backfill-queue/${currentBatchId}/cancel`, {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Backfill geannuleerd",
          description: "De backfill is geannuleerd.",
        })
        stopPolling()
      } else {
        throw new Error(data.error || 'Failed to cancel backfill')
      }
    } catch (error) {
      toast({
        title: "Fout",
        description: error instanceof Error ? error.message : 'Failed to cancel backfill',
        variant: 'destructive',
      })
    }
  }

  // Retry failed leads
  const handleRetry = async () => {
    if (!currentBatchId) return

    try {
      const response = await fetch(`/api/instantly/backfill-queue/${currentBatchId}/retry`, {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Opnieuw proberen",
          description: `${data.retried} mislukte leads worden opnieuw verwerkt.`,
        })
        startPolling()
      } else {
        throw new Error(data.error || 'Failed to retry leads')
      }
    } catch (error) {
      toast({
        title: "Fout",
        description: error instanceof Error ? error.message : 'Failed to retry leads',
        variant: 'destructive',
      })
    }
  }

  // Handler for selecting a batch from history
  const handleSelectBatch = (batchId: string) => {
    setCurrentBatchId(batchId)
    setActiveTab("current")
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="current" className="flex items-center gap-2">
          <Play className="h-4 w-4" />
          Huidige Batch
        </TabsTrigger>
        <TabsTrigger value="history" className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Geschiedenis
        </TabsTrigger>
      </TabsList>

      <TabsContent value="current" className="space-y-6">
        {/* Controls */}
        <BackfillControls
          batch={batchStatus}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onCancel={handleCancel}
          onRetry={handleRetry}
          onRefresh={manualRefresh}
          isLoading={isPolling}
          canManualRefresh={canManualRefresh}
        />

        {/* Progress */}
        {(currentBatchId || initialLoading) && (
          <BackfillProgress
            batch={batchStatus}
            progress={progress}
            eta={eta}
            statusMessage={getStatusMessage()}
            elapsedTime={elapsedTime}
            loading={initialLoading}
          />
        )}

        {/* Activity Log */}
        {currentBatchId && (
          <BackfillActivityLog
            batchId={currentBatchId}
            batchStatus={batchStatus?.status}
          />
        )}

        {/* Leads Table */}
        {currentBatchId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <BackfillLeadsTable
                batchId={currentBatchId}
                batchStatus={batchStatus?.status}
              />
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <strong>Error:</strong> {error}
          </div>
        )}
      </TabsContent>

      <TabsContent value="history" className="space-y-6">
        <BackfillHistory onSelectBatch={handleSelectBatch} />
      </TabsContent>
    </Tabs>
  )
}
