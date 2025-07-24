"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Users, TrendingUp } from "lucide-react"
import { supabaseService } from "@/lib/supabase-service"

interface CompanyStatsData {
  totalCompanies: number
  customerCompanies: number
  companiesWithJobs: number
  topCompanies: Array<{
    name: string
    job_count: number
    rating_indeed?: number
  }>
  statusCounts?: Record<string, number>
}

export function CompanyStats({ refreshKey }: { refreshKey?: any } = {}) {
  const [stats, setStats] = useState<CompanyStatsData | null>(null)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await supabaseService.getCompanyStats()
        setStats(data)
        // Haal status counts op
        if (supabaseService.getCompanyStatusCounts) {
          const statusData = await supabaseService.getCompanyStatusCounts()
          setStatusCounts(statusData)
        } else if (data.statusCounts) {
          setStatusCounts(data.statusCounts)
        }
      } catch (error) {
        console.error("Error fetching company stats:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [refreshKey])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-3 bg-gray-200 rounded animate-pulse w-24"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Totaal Bedrijven</CardTitle>
          <Building2 className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalCompanies.toLocaleString()}</div>
          <p className="text-xs text-gray-600">In de database</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Status per bedrijf</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-gray-400"></span>
              <span className="text-sm">Prospect:</span>
              <span className="font-bold">{statusCounts["Prospect"] || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-sm">Qualified:</span>
              <span className="font-bold">{statusCounts["Qualified"] || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-sm">Disqualified:</span>
              <span className="font-bold">{statusCounts["Disqualified"] || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
