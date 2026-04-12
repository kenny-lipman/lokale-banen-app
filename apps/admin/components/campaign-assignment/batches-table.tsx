"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Eye, CheckCircle2, XCircle, Loader2, Clock, ChevronDown, ChevronRight, Layers } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import { CampaignAssignmentBatch } from "@/hooks/use-campaign-assignment"

interface CampaignAssignmentBatchesTableProps {
  batches: CampaignAssignmentBatch[]
  loading: boolean
  onSelectBatch: (batchId: string) => void
}

/** Derive the platform name from platform_stats JSONB (first key) */
function getPlatformName(batch: CampaignAssignmentBatch): string | null {
  if (!batch.platform_stats || typeof batch.platform_stats !== 'object') return null
  const keys = Object.keys(batch.platform_stats)
  return keys.length > 0 ? keys[0] : null
}

/** Group for orchestrated batches */
interface OrchestrationGroup {
  orchestrationId: string
  batches: CampaignAssignmentBatch[]
  totalCandidates: number
  totalProcessed: number
  totalAdded: number
  totalSkipped: number
  totalErrors: number
  earliestCreatedAt: string
  latestCompletedAt: string | null
  overallStatus: string
}

function groupBatches(batches: CampaignAssignmentBatch[]): {
  orchestrations: OrchestrationGroup[]
  standalone: CampaignAssignmentBatch[]
} {
  const orchMap = new Map<string, CampaignAssignmentBatch[]>()
  const standalone: CampaignAssignmentBatch[] = []

  for (const batch of batches) {
    if (batch.orchestration_id) {
      const arr = orchMap.get(batch.orchestration_id) || []
      arr.push(batch)
      orchMap.set(batch.orchestration_id, arr)
    } else {
      standalone.push(batch)
    }
  }

  const orchestrations: OrchestrationGroup[] = Array.from(orchMap.entries()).map(([orchId, orchBatches]) => {
    const totalCandidates = orchBatches.reduce((s, b) => s + b.total_candidates, 0)
    const totalProcessed = orchBatches.reduce((s, b) => s + b.processed, 0)
    const totalAdded = orchBatches.reduce((s, b) => s + b.added, 0)
    const totalSkipped = orchBatches.reduce((s, b) => s + b.skipped, 0)
    const totalErrors = orchBatches.reduce((s, b) => s + b.errors, 0)

    const earliestCreatedAt = orchBatches.reduce((min, b) =>
      b.created_at < min ? b.created_at : min, orchBatches[0].created_at)

    const completedAts = orchBatches
      .filter(b => b.completed_at)
      .map(b => b.completed_at!)
    const latestCompletedAt = completedAts.length > 0
      ? completedAts.reduce((max, t) => t > max ? t : max, completedAts[0])
      : null

    const hasProcessing = orchBatches.some(b => b.status === 'processing' || b.status === 'pending')
    const hasFailed = orchBatches.some(b => b.status === 'failed')
    const allCompleted = orchBatches.every(b => b.status === 'completed')

    const overallStatus = hasProcessing ? 'processing'
      : allCompleted ? 'completed'
      : hasFailed ? 'partial_failure'
      : 'completed'

    return {
      orchestrationId: orchId,
      batches: orchBatches,
      totalCandidates,
      totalProcessed,
      totalAdded,
      totalSkipped,
      totalErrors,
      earliestCreatedAt,
      latestCompletedAt,
      overallStatus,
    }
  })

  return { orchestrations, standalone }
}

export function CampaignAssignmentBatchesTable({
  batches,
  loading,
  onSelectBatch,
}: CampaignAssignmentBatchesTableProps) {
  const [expandedOrchestrations, setExpandedOrchestrations] = useState<Set<string>>(new Set())

  const toggleExpanded = (orchId: string) => {
    setExpandedOrchestrations(prev => {
      const next = new Set(prev)
      if (next.has(orchId)) {
        next.delete(orchId)
      } else {
        next.add(orchId)
      }
      return next
    })
  }

  if (loading && batches.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[180px]">Batch / Orchestratie</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Voortgang</TableHead>
              <TableHead>Resultaat</TableHead>
              <TableHead className="w-[160px]">Tijd</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (batches.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">Nog geen batches uitgevoerd</p>
      </div>
    )
  }

  const { orchestrations, standalone } = groupBatches(batches)

  // Merge and sort by date (most recent first)
  type RowItem =
    | { type: 'orchestration'; data: OrchestrationGroup }
    | { type: 'standalone'; data: CampaignAssignmentBatch }

  const rows: RowItem[] = [
    ...orchestrations.map(o => ({ type: 'orchestration' as const, data: o, sortDate: o.earliestCreatedAt })),
    ...standalone.map(b => ({ type: 'standalone' as const, data: b, sortDate: b.created_at })),
  ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead className="w-[180px]">Batch / Orchestratie</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Voortgang</TableHead>
            <TableHead>Resultaat</TableHead>
            <TableHead className="w-[160px]">Tijd</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            if (row.type === 'orchestration') {
              const orch = row.data
              const isExpanded = expandedOrchestrations.has(orch.orchestrationId)
              const progress = orch.totalCandidates > 0
                ? Math.round((orch.totalProcessed / orch.totalCandidates) * 100)
                : 0
              const timeAgo = formatDistanceToNow(new Date(orch.earliestCreatedAt), {
                addSuffix: true,
                locale: nl,
              })
              const duration = orch.earliestCreatedAt && orch.latestCompletedAt
                ? Math.round((new Date(orch.latestCompletedAt).getTime() - new Date(orch.earliestCreatedAt).getTime()) / 1000)
                : null

              return (
                <>
                  {/* Orchestration header row */}
                  <TableRow
                    key={orch.orchestrationId}
                    className="cursor-pointer hover:bg-muted/50 bg-muted/20"
                    onClick={() => toggleExpanded(orch.orchestrationId)}
                  >
                    <TableCell>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-blue-500" />
                        <span className="font-medium text-xs">
                          {orch.batches.length} platforms
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <BatchStatusBadge status={orch.overallStatus} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="w-24 h-2" />
                        <span className="text-xs text-muted-foreground">
                          {orch.totalProcessed}/{orch.totalCandidates}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-600">{orch.totalAdded} added</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-yellow-600">{orch.totalSkipped} skipped</span>
                        {orch.totalErrors > 0 && (
                          <>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-red-600">{orch.totalErrors} errors</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{timeAgo}</div>
                      {duration !== null && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {duration}s
                        </div>
                      )}
                    </TableCell>
                    <TableCell />
                  </TableRow>

                  {/* Expanded platform batches */}
                  {isExpanded && orch.batches.map((batch) => {
                    const batchProgress = batch.total_candidates > 0
                      ? Math.round((batch.processed / batch.total_candidates) * 100)
                      : 0
                    const platformName = getPlatformName(batch)
                    const batchDuration = batch.started_at && batch.completed_at
                      ? Math.round((new Date(batch.completed_at).getTime() - new Date(batch.started_at).getTime()) / 1000)
                      : null

                    return (
                      <TableRow
                        key={batch.id}
                        className="cursor-pointer hover:bg-muted/50 bg-blue-50/30"
                        onClick={() => onSelectBatch(batch.batch_id)}
                      >
                        <TableCell />
                        <TableCell className="pl-8">
                          <span className="text-xs text-muted-foreground">
                            {platformName || batch.batch_id.slice(0, 20)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <BatchStatusBadge status={batch.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={batchProgress} className="w-24 h-2" />
                            <span className="text-xs text-muted-foreground">
                              {batch.processed}/{batch.total_candidates}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-green-600">{batch.added}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-yellow-600">{batch.skipped}</span>
                            {batch.errors > 0 && (
                              <>
                                <span className="text-muted-foreground">/</span>
                                <span className="text-red-600">{batch.errors}</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {batchDuration !== null && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {batchDuration}s
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectBatch(batch.batch_id)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </>
              )
            }

            // Standalone (non-orchestrated) batch
            const batch = row.data
            const progress = batch.total_candidates > 0
              ? Math.round((batch.processed / batch.total_candidates) * 100)
              : 0
            const timeAgo = formatDistanceToNow(new Date(batch.created_at), {
              addSuffix: true,
              locale: nl,
            })
            const duration = batch.started_at && batch.completed_at
              ? Math.round((new Date(batch.completed_at).getTime() - new Date(batch.started_at).getTime()) / 1000)
              : null

            return (
              <TableRow
                key={batch.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelectBatch(batch.batch_id)}
              >
                <TableCell />
                <TableCell className="font-mono text-xs">
                  {batch.batch_id.slice(0, 20)}...
                </TableCell>
                <TableCell>
                  <BatchStatusBadge status={batch.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={progress} className="w-24 h-2" />
                    <span className="text-xs text-muted-foreground">
                      {batch.processed}/{batch.total_candidates}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-600">{batch.added} added</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-yellow-600">{batch.skipped} skipped</span>
                    {batch.errors > 0 && (
                      <>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-red-600">{batch.errors} errors</span>
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <div>{timeAgo}</div>
                  {duration !== null && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {duration}s
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectBatch(batch.batch_id)
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function BatchStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-700">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Voltooid
        </Badge>
      )
    case 'processing':
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Bezig
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Gefaald
        </Badge>
      )
    case 'partial_failure':
      return (
        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
          <XCircle className="h-3 w-3 mr-1" />
          Deels gefaald
        </Badge>
      )
    case 'cancelled':
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-600">
          <XCircle className="h-3 w-3 mr-1" />
          Geannuleerd
        </Badge>
      )
    case 'pending':
    default:
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Wachten
        </Badge>
      )
  }
}
