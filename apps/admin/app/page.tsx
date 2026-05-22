"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, Building2, Users } from "lucide-react"
import {
  useDashboardStats,
  useDashboardApifyRuns,
  useDashboardContactStats,
} from "@/hooks/use-dashboard-cache"
import { QueryError } from "@/components/QueryState"

function StatCard({
  title,
  Icon,
  value,
  loading,
  error,
  onRetry,
}: {
  title: string
  Icon: React.ComponentType<{ className?: string }>
  value: number | undefined
  loading: boolean
  error: any
  onRetry: () => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-orange-500" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 bg-gray-200 rounded animate-pulse mb-2 w-24"></div>
        ) : error ? (
          <QueryError onRetry={onRetry} />
        ) : (
          <div className="text-2xl font-bold">{(value ?? 0).toLocaleString()}</div>
        )}
      </CardContent>
    </Card>
  )
}

export default function OtisHomePage() {
  const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats()
  const { contactStats, loading: contactsLoading, error: contactsError, refetch: refetchContacts } = useDashboardContactStats()

  const totalContacts = contactStats?.totalContacts || 0
  const platformCounts = stats?.platformCounts || {}
  const totalPlatform = Number(Object.values(platformCounts).reduce((a, b) => Number(a) + Number(b), 0))
  const platformData = Object.entries(platformCounts).map(([platform, count]) => ({
    platform,
    count: Number(count),
    percentage: totalPlatform > 0 ? Math.round((Number(count) / totalPlatform) * 100) : 0,
  }))

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">OTIS</h1>
        <p className="text-gray-600 mt-2">Overzicht van Lokale Banen AI agents en activiteiten</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Vacatures"
          Icon={BarChart3}
          value={stats?.totalJobs}
          loading={statsLoading}
          error={statsError}
          onRetry={refetchStats}
        />
        <StatCard
          title="Bedrijven"
          Icon={Building2}
          value={stats?.totalCompanies}
          loading={statsLoading}
          error={statsError}
          onRetry={refetchStats}
        />
        <StatCard
          title="Contacten"
          Icon={Users}
          value={totalContacts}
          loading={contactsLoading}
          error={contactsError}
          onRetry={refetchContacts}
        />
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Platform Verdeling</CardTitle>
          <CardDescription>Jobs per platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {statsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="h-4 w-24 bg-gray-200 rounded animate-pulse"></span>
                    <span className="h-4 w-8 bg-gray-200 rounded animate-pulse"></span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-orange-200 h-2 rounded-full animate-pulse" style={{ width: `60%` }}></div>
                  </div>
                </div>
              ))
            ) : statsError ? (
              <QueryError onRetry={refetchStats} />
            ) : platformData.length === 0 ? (
              <div className="text-gray-500 text-sm">Geen platform data</div>
            ) : (
              platformData.map((item) => (
                <div key={item.platform} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{item.platform}</span>
                    <span className="text-gray-600">{item.count.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${item.percentage}%` }}></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
