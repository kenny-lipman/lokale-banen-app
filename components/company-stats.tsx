"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Users, Star, TrendingUp } from "lucide-react"
import { supabaseService } from "@/lib/supabase-service"

interface CompanyStatsData {
  totalCompanies: number
  customerCompanies: number
  averageRating: number
  companiesWithJobs: number
  topCompanies: Array<{
    name: string
    job_count: number
    rating_indeed?: number
  }>
}

export function CompanyStats() {
  const [stats, setStats] = useState<CompanyStatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await supabaseService.getCompanyStats()
        setStats(data)
      } catch (error) {
        console.error("Error fetching company stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
          <CardTitle className="text-sm font-medium">Klanten</CardTitle>
          <Users className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.customerCompanies.toLocaleString()}</div>
          <p className="text-xs text-gray-600">
            {stats.totalCompanies > 0
              ? `${Math.round((stats.customerCompanies / stats.totalCompanies) * 100)}% van totaal`
              : "0% van totaal"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gemiddelde Rating</CardTitle>
          <Star className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "N/A"}</div>
          <p className="text-xs text-gray-600">Indeed reviews</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Actieve Bedrijven</CardTitle>
          <TrendingUp className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.companiesWithJobs.toLocaleString()}</div>
          <p className="text-xs text-gray-600">Met vacatures</p>
        </CardContent>
      </Card>
    </div>
  )
}
