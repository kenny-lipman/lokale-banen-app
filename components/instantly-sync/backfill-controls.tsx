"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Play,
  Pause,
  Square,
  RefreshCw,
  RotateCcw,
  Loader2,
  Rocket,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { BackfillBatch } from "@/lib/services/instantly-backfill.service"

interface BackfillControlsProps {
  batch: BackfillBatch | null
  onStart: (options: { dryRun?: boolean; batchSize?: number; maxLeadsToCollect?: number }) => Promise<void>
  onPause: () => Promise<void>
  onResume: () => Promise<void>
  onCancel: () => Promise<void>
  onRetry: () => Promise<void>
  onRefresh: () => void
  isLoading: boolean
  canManualRefresh: boolean
}

export function BackfillControls({
  batch,
  onStart,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRefresh,
  isLoading,
  canManualRefresh,
}: BackfillControlsProps) {
  const [isStarting, setIsStarting] = useState(false)
  const [isPausing, setIsPausing] = useState(false)
  const [isResuming, setIsResuming] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [batchSize, setBatchSize] = useState(25)
  const [maxLeadsToCollect, setMaxLeadsToCollect] = useState<number | undefined>(undefined)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const isActive = batch && ['processing', 'collecting'].includes(batch.status)
  const isPaused = batch?.status === 'paused'
  const isCompleted = batch && ['completed', 'failed', 'cancelled'].includes(batch.status)
  const hasFailedLeads = batch && batch.failed_leads > 0
  const canStart = !batch || isCompleted

  const handleStart = async () => {
    setIsStarting(true)
    try {
      await onStart({ dryRun, batchSize, maxLeadsToCollect })
    } finally {
      setIsStarting(false)
    }
  }

  const handlePause = async () => {
    setIsPausing(true)
    try {
      await onPause()
    } finally {
      setIsPausing(false)
    }
  }

  const handleResume = async () => {
    setIsResuming(true)
    try {
      await onResume()
    } finally {
      setIsResuming(false)
    }
  }

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      await onCancel()
    } finally {
      setIsCancelling(false)
    }
  }

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      await onRetry()
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Backfill Controls</CardTitle>
        <CardDescription>
          Start een nieuwe backfill of beheer de huidige operatie
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Start New Backfill */}
        {canStart && (
          <div className="space-y-4 p-4 border rounded-lg">
            <h4 className="font-medium">Nieuwe Backfill Starten</h4>

            <div className="space-y-4">
              {/* Main options row */}
              <div className="flex items-center gap-6">
                {/* Max Leads to Collect - Primary option */}
                <div className="flex items-center gap-2">
                  <Label htmlFor="max-leads">Max leads:</Label>
                  <Input
                    id="max-leads"
                    type="number"
                    min={1}
                    max={10000}
                    value={maxLeadsToCollect || ''}
                    onChange={(e) => setMaxLeadsToCollect(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Alles"
                    className="w-24"
                  />
                </div>

                {/* Dry Run Toggle */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="dry-run"
                    checked={dryRun}
                    onCheckedChange={setDryRun}
                  />
                  <Label htmlFor="dry-run">Dry Run</Label>
                </div>
              </div>

              {/* Advanced toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Geavanceerde opties
              </button>

              {/* Advanced options */}
              {showAdvanced && (
                <div className="pl-4 border-l-2 border-muted space-y-3">
                  {/* Batch Size */}
                  <div className="flex items-center gap-2">
                    <Label htmlFor="batch-size" className="text-sm">Batch grootte:</Label>
                    <Input
                      id="batch-size"
                      type="number"
                      min={5}
                      max={100}
                      value={batchSize}
                      onChange={(e) => setBatchSize(parseInt(e.target.value) || 25)}
                      className="w-20"
                    />
                    <span className="text-xs text-muted-foreground">leads per verwerkingsronde</span>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={handleStart}
              disabled={isStarting}
              className="w-full"
              size="lg"
            >
              {isStarting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4" />
                  Start Backfill
                </>
              )}
            </Button>

            {dryRun && (
              <p className="text-sm text-muted-foreground">
                In dry run modus worden geen echte wijzigingen gemaakt in Pipedrive.
              </p>
            )}
          </div>
        )}

        {/* Active Controls */}
        {(isActive || isPaused) && (
          <div className="flex flex-wrap gap-2">
            {/* Pause/Resume */}
            {isActive && (
              <Button
                variant="outline"
                onClick={handlePause}
                disabled={isPausing}
              >
                {isPausing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Pause className="mr-2 h-4 w-4" />
                )}
                Pauzeren
              </Button>
            )}

            {isPaused && (
              <Button
                variant="outline"
                onClick={handleResume}
                disabled={isResuming}
              >
                {isResuming ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Hervatten
              </Button>
            )}

            {/* Cancel */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isCancelling}>
                  {isCancelling ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="mr-2 h-4 w-4" />
                  )}
                  Annuleren
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Backfill Annuleren?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Weet je zeker dat je de backfill wilt annuleren? Je kunt de niet-verwerkte leads later opnieuw proberen.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Nee, doorgaan</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel}>
                    Ja, annuleren
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Manual Refresh */}
            {canManualRefresh && (
              <Button
                variant="outline"
                onClick={onRefresh}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Status Verversen
              </Button>
            )}
          </div>
        )}

        {/* Retry Failed Leads */}
        {isCompleted && hasFailedLeads && (
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-red-50 dark:bg-red-950/20">
            <div className="flex-1">
              <h4 className="font-medium">Mislukte Leads</h4>
              <p className="text-sm text-muted-foreground">
                {batch.failed_leads} leads zijn niet gesynchroniseerd.
                Je kunt deze opnieuw proberen.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Opnieuw Proberen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
