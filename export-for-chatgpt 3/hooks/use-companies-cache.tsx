import { useState, useRef, useEffect } from "react"
import { supabaseService } from "@/lib/supabase-service"

// Cache companies data to avoid repeated API calls
let companiesCache: { [key: string]: any } = {}

// Clear cache when this module reloads (in development)
const CACHE_VERSION = "3.0" // Optimized companies query without complex joins

export function useCompaniesCache(params: {
  page?: number
  limit?: number
  search?: string
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
  status?: string
  source?: string
  is_customer?: boolean
  regionIds?: string[]
  sizeRange?: { min: number, max: number|null }
  unknownSize?: boolean
  websiteFilter?: 'all' | 'with' | 'without'
}) {
  const cacheKey = JSON.stringify(params)
  const [data, setData] = useState<any>(companiesCache[cacheKey] || null)
  const [loading, setLoading] = useState(!companiesCache[cacheKey])
  const [error, setError] = useState<any>(null)
  const fetchRef = useRef(0)

  const fetchCompanies = async () => {
    setLoading(true)
    setError(null)
    fetchRef.current++
    const thisFetch = fetchRef.current
    try {
      const result = await supabaseService.getCompanies(params)
      companiesCache[cacheKey] = result
      if (thisFetch === fetchRef.current) {
        setData(result)
        setLoading(false)
      }
    } catch (e) {
      if (thisFetch === fetchRef.current) {
        console.error("use-companies-cache: Error fetching companies:", e)
        console.error("use-companies-cache: Error type:", typeof e, JSON.stringify(e))
        console.error("use-companies-cache: Params used:", params)
        setError(e)
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!companiesCache[cacheKey]) {
      fetchCompanies()
    } else {
      setData(companiesCache[cacheKey])
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  return {
    data,
    loading,
    error,
    refetch: fetchCompanies,
  }
} 