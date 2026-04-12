"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  Clock,
  Loader2,
  Pause,
  Ban,
  AlertCircle,
  FlaskConical,
  Folders,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import type { BackfillBatch } from "@/lib/services/instantly-backfill.service"

interface BackfillProgressProps {
  batch: BackfillBatch | null
  progress: {
    percentage: number
    synced: number
    skipped: number
    failed: number
    total: number
  } | null
  eta: {
    estimatedMinutesRemaining: number
    leadsPerMinute: number
  } | null
  statusMessage: string
  elapsedTime: number
  loading?: boolean
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  pending: { label: "Wachtend", variant: "outline", icon: <Clock className="h-3 w-3" /> },
  collecting: { label: "Verzamelen", variant: "secondary", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  processing: { label: "Verwerken", variant: "default", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  paused: { label: "Gepauzeerd", variant: "outline", icon: <Pause className="h-3 w-3" /> },
  completed: { label: "Voltooid", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  failed: { label: "Mislukt", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  cancelled: { label: "Geannuleerd", variant: "outline", icon: <Ban className="h-3 w-3" /> },
}

export function BackfillProgress({
  batch,
  progress,
  eta,
  statusMessage,
  elapsedTime: _elapsedTime,
  loading = false,
}: BackfillProgressProps) {
  if (loading || !batch) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[batch.status] || STATUS_CONFIG.pending
  const isActive = batch.status === 'processing' || batch.status === 'collecting'

  return (
    <div className="space-y-4">
      {/* Main Progress Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              Backfill Progress
              <Badge variant={statusConfig.variant} className="ml-2 flex items-center gap-1">
                {statusConfig.icon}
                {statusConfig.label}
              </Badge>
              {batch.dry_run && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700 flex items-center gap-1">
                  <FlaskConical className="h-3 w-3" />
                  DRY RUN
                </Badge>
              )}
            </CardTitle>
            {batch.started_at && (
              <span className="text-sm text-muted-foreground">
                Gestart {formatDistanceToNow(new Date(batch.started_at), { addSuffix: true, locale: nl })}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dry Run Alert */}
          {batch.dry_run && (
            <Alert className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
              <FlaskConical className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-300">Test Modus (Dry Run)</AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                Dit is een test run. Leads worden <strong>niet</strong> gesynchroniseerd naar Pipedrive
                en <strong>niet</strong> verwijderd uit Instantly. Alle acties worden alleen gesimuleerd.
              </AlertDescription>
            </Alert>
          )}

          {/* Collection Progress (Campaign X/Y) */}
          {batch.status === 'collecting' && batch.total_campaigns > 0 && (
            <div className="flex items-center gap-3 text-sm bg-blue-50 dark:bg-blue-950/30 rounded-lg px-4 py-3 border border-blue-200 dark:border-blue-800">
              <Folders className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <div>
                <span className="text-blue-700 dark:text-blue-300">
                  Campagne <strong>{batch.current_campaign_index}</strong> van <strong>{batch.total_campaigns}</strong>
                </span>
                {batch.current_campaign_name && (
                  <span className="ml-2 text-blue-600 dark:text-blue-400 truncate">
                    — {batch.current_campaign_name}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{statusMessage}</span>
              {progress && (
                <span className="font-medium">{progress.percentage}%</span>
              )}
            </div>
            <Progress value={progress?.percentage || 0} className="h-3" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Leads */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Totaal</span>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {batch.total_leads.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            {/* Synced */}
            <Card className="bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Gesynchroniseerd</span>
                </div>
                <div className="text-2xl font-bold mt-1 text-green-600">
                  {batch.synced_leads.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            {/* Skipped */}
            <Card className="bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <SkipForward className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium">Overgeslagen</span>
                </div>
                <div className="text-2xl font-bold mt-1 text-yellow-600">
                  {batch.skipped_leads.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            {/* Failed */}
            <Card className="bg-red-50 dark:bg-red-950/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium">Mislukt</span>
                </div>
                <div className="text-2xl font-bold mt-1 text-red-600">
                  {batch.failed_leads.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ETA & Speed */}
          {isActive && eta && (
            <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  Geschatte tijd resterend: <strong>{eta.estimatedMinutesRemaining} minuten</strong>
                </span>
              </div>
              <div>
                Snelheid: <strong>{eta.leadsPerMinute} leads/min</strong>
              </div>
            </div>
          )}

          {/* Error Message */}
          {batch.last_error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg px-4 py-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{batch.last_error}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
