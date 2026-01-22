"use client"

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
import { Eye, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { nl } from "date-fns/locale"
import { CampaignAssignmentBatch } from "@/hooks/use-campaign-assignment"

interface CampaignAssignmentBatchesTableProps {
  batches: CampaignAssignmentBatch[]
  loading: boolean
  onSelectBatch: (batchId: string) => void
}

export function CampaignAssignmentBatchesTable({
  batches,
  loading,
  onSelectBatch,
}: CampaignAssignmentBatchesTableProps) {
  if (loading && batches.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Batch ID</TableHead>
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

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Batch ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Voortgang</TableHead>
            <TableHead>Resultaat</TableHead>
            <TableHead className="w-[160px]">Tijd</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch) => {
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
