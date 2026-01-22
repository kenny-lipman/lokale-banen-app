"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Activity,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import type { BackfillBatchStatus } from "@/lib/services/instantly-backfill.service"

interface ActivityLog {
  id: string
  batch_id: string
  log_type: 'info' | 'success' | 'warning' | 'error'
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

interface BackfillActivityLogProps {
  batchId: string | null
  batchStatus?: BackfillBatchStatus | null
}

const LOG_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  info: {
    icon: <Info className="h-3.5 w-3.5" />,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
  },
  success: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/30",
  },
  warning: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
  error: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
  },
}

const AUTO_REFRESH_INTERVAL = 3000 // 3 seconds

export function BackfillActivityLog({ batchId, batchStatus }: BackfillActivityLogProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchLogs = useCallback(async (silent = false) => {
    if (!batchId) return

    if (!silent) setLoading(true)
    try {
      const response = await fetch(`/api/instantly/backfill-queue/logs/${batchId}?limit=50`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.logs)
      }
    } catch (error) {
      console.error("Failed to fetch activity logs:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [batchId])

  // Initial fetch
  useEffect(() => {
    if (batchId) {
      fetchLogs()
    }
  }, [batchId, fetchLogs])

  // Auto-refresh during processing or collecting
  useEffect(() => {
    const isProcessing = batchStatus === 'processing' || batchStatus === 'collecting'

    if (isProcessing && batchId) {
      setIsAutoRefreshing(true)
      refreshIntervalRef.current = setInterval(() => {
        fetchLogs(true)
      }, AUTO_REFRESH_INTERVAL)
    } else {
      setIsAutoRefreshing(false)
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = null
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = null
      }
    }
  }, [batchStatus, batchId, fetchLogs])

  if (!batchId) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Log
          </CardTitle>
          {isAutoRefreshing && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Live
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Activity className="h-8 w-8 mb-2 opacity-50" />
              <p>Geen activiteit gevonden</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const config = LOG_TYPE_CONFIG[log.log_type] || LOG_TYPE_CONFIG.info
                return (
                  <div
                    key={log.id}
                    className={`flex items-start gap-3 p-3 rounded-lg ${config.bg}`}
                  >
                    <div className={`mt-0.5 ${config.color}`}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{log.message}</p>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {Object.entries(log.metadata).map(([key, value]) => (
                            <span key={key} className="mr-3">
                              {key}: <strong>{String(value)}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: nl })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
