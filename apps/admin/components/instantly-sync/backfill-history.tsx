"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  Clock,
  Loader2,
  Pause,
  Ban,
  History,
  RefreshCw,
  FlaskConical,
  Eye,
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { nl } from "date-fns/locale"
import type { BackfillBatch, BackfillBatchStatus } from "@/lib/services/instantly-backfill.service"

interface BackfillHistoryProps {
  onSelectBatch?: (batchId: string) => void
}

const STATUS_CONFIG: Record<BackfillBatchStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  pending: { label: "Wachtend", variant: "outline", icon: <Clock className="h-3 w-3" /> },
  collecting: { label: "Verzamelen", variant: "secondary", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  processing: { label: "Verwerken", variant: "default", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  paused: { label: "Gepauzeerd", variant: "outline", icon: <Pause className="h-3 w-3" /> },
  completed: { label: "Voltooid", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  failed: { label: "Mislukt", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  cancelled: { label: "Geannuleerd", variant: "outline", icon: <Ban className="h-3 w-3" /> },
}

export function BackfillHistory({ onSelectBatch }: BackfillHistoryProps) {
  const [batches, setBatches] = useState<BackfillBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const fetchBatches = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "25" })
      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }

      const response = await fetch(`/api/instantly/backfill-queue?${params}`)
      const data = await response.json()

      if (data.success) {
        setBatches(data.batches)
      }
    } catch (error) {
      console.error("Failed to fetch batches:", error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              Batch Geschiedenis
            </CardTitle>
            <CardDescription>
              Overzicht van alle backfill operaties
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Alle statussen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="completed">Voltooid</SelectItem>
                <SelectItem value="failed">Mislukt</SelectItem>
                <SelectItem value="cancelled">Geannuleerd</SelectItem>
                <SelectItem value="processing">Bezig</SelectItem>
                <SelectItem value="paused">Gepauzeerd</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchBatches} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : batches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <History className="h-8 w-8 mb-2 opacity-50" />
            <p>Geen batches gevonden</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resultaat</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => {
                  const statusConfig = STATUS_CONFIG[batch.status]

                  return (
                    <TableRow key={batch.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[120px]" title={batch.batch_id}>
                            {batch.batch_id.slice(0, 12)}...
                          </span>
                          {batch.dry_run && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700 text-xs">
                              <FlaskConical className="h-2.5 w-2.5 mr-1" />
                              DRY
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="flex items-center gap-1 w-fit">
                          {statusConfig.icon}
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {batch.synced_leads}
                          </span>
                          <span className="text-amber-600 flex items-center gap-1">
                            <SkipForward className="h-3 w-3" />
                            {batch.skipped_leads}
                          </span>
                          <span className="text-red-600 flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            {batch.failed_leads}
                          </span>
                          <span className="text-muted-foreground">
                            / {batch.total_leads}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex flex-col">
                          <span>{format(new Date(batch.created_at), "d MMM yyyy", { locale: nl })}</span>
                          <span className="text-xs">
                            {formatDistanceToNow(new Date(batch.created_at), { addSuffix: true, locale: nl })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {onSelectBatch && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSelectBatch(batch.batch_id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Details
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
