import { useState, useRef, useEffect } from "react"
import { supabaseService } from "@/lib/supabase-service"

const CACHE_VERSION = "2.5" // Removed contacts array, using contact stats for performance
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
      
      // Get contact stats separately instead of loading all contacts
      const contactStats = await supabaseService.getContactStats()
      console.log("Dashboard cache: Fetched contact stats:", contactStats?.totalContacts || 0)
      
      const result = { 
        stats: {
          ...stats,
          totalContacts: contactStats?.totalContacts || 0
        }, 
        apifyRuns 
      }
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