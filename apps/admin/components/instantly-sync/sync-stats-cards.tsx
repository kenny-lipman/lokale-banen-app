"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Activity,
  CheckCircle2,
  XCircle,
  SkipForward,
  Clock,
  TrendingUp,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"

interface SyncStatsCardsProps {
  stats: {
    total: number
    successCount: number
    errorCount: number
    skippedCount: number
    successRate: number
    lastSyncAt: string | null
  }
  loading: boolean
}

export function SyncStatsCards({ stats, loading }: SyncStatsCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const lastSyncText = stats.lastSyncAt
    ? formatDistanceToNow(new Date(stats.lastSyncAt), { addSuffix: true, locale: nl })
    : "Nog geen syncs"

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Events */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Totaal Events</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Alle webhook events
          </p>
        </CardContent>
      </Card>

      {/* Success Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            <span className={stats.successRate >= 90 ? "text-green-600" : stats.successRate >= 70 ? "text-yellow-600" : "text-red-600"}>
              {stats.successRate}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.successCount.toLocaleString()} succesvol
          </p>
        </CardContent>
      </Card>

      {/* Errors */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Errors</CardTitle>
          <XCircle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            <span className={stats.errorCount > 0 ? "text-red-600" : "text-green-600"}>
              {stats.errorCount.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.skippedCount.toLocaleString()} overgeslagen
          </p>
        </CardContent>
      </Card>

      {/* Last Sync */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Laatste Sync</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {stats.lastSyncAt ? "Live" : "-"}
          </div>
          <p className="text-xs text-muted-foreground">
            {lastSyncText}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
