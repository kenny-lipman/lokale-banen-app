"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"

interface PlatformStats {
  total: number
  active: number
  inactive: number
}

export function usePlatformStats() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      
      const { data, error: queryError } = await supabase
        .from("platforms")
        .select("is_active")
        .not("regio_platform", "is", null)
        .not("regio_platform", "eq", "")
      
      if (queryError) {
        throw queryError
      }
      
      const total = data?.length || 0
      const active = data?.filter(platform => platform.is_active === true).length || 0
      const inactive = total - active
      
      setStats({
        total,
        active,
        inactive
      })
    } catch (err) {
      setError("Failed to fetch platform statistics")
      console.error("Error fetching platform stats:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  }
}