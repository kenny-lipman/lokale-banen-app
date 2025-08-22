"use client"

import { useState, useEffect } from "react"

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
      const response = await fetch("/api/platforms?stats=true")
      const result = await response.json()
      
      if (result.success) {
        setStats(result.data)
      } else {
        setError(result.error || "Failed to fetch platform statistics")
      }
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