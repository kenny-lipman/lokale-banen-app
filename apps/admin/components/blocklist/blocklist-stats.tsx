"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Mail,
  Globe,
  Shield,
  ShieldOff,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

interface BlocklistStats {
  overview: {
    total: number
    active: number
    inactive: number
  }
  byType: {
    email: number
    domain: number
  }
  syncStatus: {
    instantly: {
      synced: number
      pending: number
    }
    pipedrive: {
      synced: number
      pending: number
    }
  }
  recentActivity: {
    last24Hours: number
    last7Days: number
  }
}

interface BlocklistStatsProps {
  stats: BlocklistStats | null
  loading?: boolean
  className?: string
}

export function BlocklistStats({ stats, loading = false, className = "" }: BlocklistStatsProps) {
  if (loading) {
    return (
      <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className}`}>
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const syncPercentage = stats.overview.total > 0
    ? Math.round(((stats.syncStatus.instantly.synced + stats.syncStatus.pipedrive.synced) / (stats.overview.total * 2)) * 100)
    : 0

  return (
    <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {/* Total Blocked */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Totaal Geblokkeerd</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.overview.total}</div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="default" className="text-xs bg-green-100 text-green-800">
              {stats.overview.active} actief
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {stats.overview.inactive} inactief
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* By Type */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Per Type</CardTitle>
          <div className="flex gap-1">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <Globe className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{stats.byType.email}</span>
            <span className="text-sm text-muted-foreground">emails</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{stats.byType.domain}</span>
            <span className="text-sm text-muted-foreground">domeinen</span>
          </div>
        </CardContent>
      </Card>

      {/* Sync Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
          {syncPercentage >= 90 ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : syncPercentage >= 50 ? (
            <Clock className="h-4 w-4 text-yellow-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{syncPercentage}%</div>
          <div className="space-y-1 mt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Instantly</span>
              <span className="font-medium">
                {stats.syncStatus.instantly.synced}/{stats.overview.active}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Pipedrive</span>
              <span className="font-medium">
                {stats.syncStatus.pipedrive.synced}/{stats.overview.active}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Recente Activiteit</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">+{stats.recentActivity.last24Hours}</div>
          <p className="text-xs text-muted-foreground">laatste 24 uur</p>
          <div className="mt-2 text-xs">
            <span className="font-medium">{stats.recentActivity.last7Days}</span>
            <span className="text-muted-foreground"> deze week toegevoegd</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}