import { useState, useRef, useEffect } from "react"
import { supabaseService } from "@/lib/supabase-service"

const CACHE_VERSION = "2.4" // Fixed companies query optimization and platform distribution scalability
const dashboardCache: { data?: any, version?: string } = {}

export function useDashboardCache() {
  // Check if cache is stale
  const isCacheValid = dashboardCache.data && dashboardCache.version === CACHE_VERSION
  const [data, setData] = useState<any>(isCacheValid ? dashboardCache.data : null)
  const [loading, setLoading] = useState(!isCacheValid)
  const [error, setError] = useState<any>(null)
  const fetchRef = useRef(0)

  const fetchDashboard = async () => {
    setLoading(true)
    setError(null)
    fetchRef.current++
    const thisFetch = fetchRef.current
    try {
      console.log("Dashboard cache: Starting to fetch data...")
      
      const stats = await supabaseService.getDashboardStats()
      console.log("Dashboard cache: Fetched stats")
      
      const apifyRuns = await supabaseService.getApifyRuns()
      console.log("Dashboard cache: Fetched apify runs")
      
      const contacts = await supabaseService.getContacts()
      console.log("Dashboard cache: Fetched contacts:", contacts?.length || 0)
      
      const result = { stats, apifyRuns, contacts }
      dashboardCache.data = result
      dashboardCache.version = CACHE_VERSION
      if (thisFetch === fetchRef.current) {
        setData(result)
        setLoading(false)
      }
    } catch (e) {
      console.error("Dashboard cache: Error fetching data:", e)
      if (thisFetch === fetchRef.current) {
        setError(e)
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!isCacheValid) {
      fetchDashboard()
    } else {
      setData(dashboardCache.data)
      setLoading(false)
    }
  }, [])

  return {
    data,
    loading,
    error,
    refetch: fetchDashboard,
  }
} 