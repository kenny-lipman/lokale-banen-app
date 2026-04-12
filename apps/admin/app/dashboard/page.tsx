"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, Building2, Users } from "lucide-react"
import { useDashboardCache } from "@/hooks/use-dashboard-cache"
import { DashboardStatsSkeleton, ListSkeleton, LoadingSpinner } from "@/components/ui/loading-states"

export default function DashboardPage() {
  const { data, loading, error, refetch } = useDashboardCache()
  // Fallbacks voor skeleton
  const stats = data?.stats || { totalJobs: 0, totalCompanies: 0, totalContacts: 0, platformCounts: {}, statusCounts: {} }
  const apifyRuns = data?.apifyRuns || []
  const totalContacts = stats.totalContacts || 0
  const platformCounts = stats.platformCounts || {}
  const totalPlatform = Number(Object.values(platformCounts).reduce((a, b) => Number(a) + Number(b), 0))
  const platformData = Object.entries(platformCounts).map(([platform, count]) => ({
    platform,
    count: Number(count),
    percentage: totalPlatform > 0 ? Math.round((Number(count) / totalPlatform) * 100) : 0,
  }))
  const recentRuns = apifyRuns.slice(0, 3)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Overzicht van LokaleBanen AI agents en activiteiten</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Vacatures */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vacatures</CardTitle>
            <BarChart3 className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 bg-gray-200 rounded animate-pulse mb-2 w-24"></div>
            ) : (
              <div className="text-2xl font-bold">{stats.totalJobs?.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
        {/* Bedrijven */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bedrijven</CardTitle>
            <Building2 className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 bg-gray-200 rounded animate-pulse mb-2 w-24"></div>
            ) : (
              <div className="text-2xl font-bold">{stats.totalCompanies?.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
        {/* Contacten */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contacten</CardTitle>
            <Users className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 bg-gray-200 rounded animate-pulse mb-2 w-24"></div>
            ) : (
              <div className="text-2xl font-bold">{totalContacts?.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Verdeling */}
      <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Platform Verdeling</CardTitle>
            <CardDescription>Jobs per platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
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
              ) : platformData.length === 0 ? (
                <div className="text-gray-500 text-sm">Geen platform data</div>
              ) : (
                platformData.map((item, index) => (
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
