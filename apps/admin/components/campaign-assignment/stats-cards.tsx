"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Activity,
  CheckCircle2,
  XCircle,
  SkipForward,
  TrendingUp,
  Building2,
} from "lucide-react"
import { CampaignAssignmentStats } from "@/hooks/use-campaign-assignment"

interface CampaignAssignmentStatsCardsProps {
  stats: CampaignAssignmentStats
  platformStats: Record<string, { added: number; skipped: number; errors: number }>
  loading: boolean
}

export function CampaignAssignmentStatsCards({
  stats,
  platformStats,
  loading,
}: CampaignAssignmentStatsCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
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

  const platformCount = Object.keys(platformStats).length

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {/* Total Processed */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Totaal Verwerkt</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Contacts vandaag
          </p>
        </CardContent>
      </Card>

      {/* Added to Instantly */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Toegevoegd</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {stats.added.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            Aan Instantly campagnes
          </p>
        </CardContent>
      </Card>

      {/* Skipped */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overgeslagen</CardTitle>
          <SkipForward className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">
            {stats.skipped.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.skippedKlant} Klant, {stats.skippedDuplicate} Duplicaat
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
            <span className={stats.errors > 0 ? "text-red-600" : "text-green-600"}>
              {stats.errors.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.skippedAiError} AI fouten
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
            <span className={
              stats.successRate >= 90 ? "text-green-600" :
              stats.successRate >= 70 ? "text-yellow-600" : "text-red-600"
            }>
              {stats.successRate}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {platformCount} platforms actief
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
