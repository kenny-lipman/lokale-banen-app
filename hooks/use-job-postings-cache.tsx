import { useState, useRef, useEffect } from "react"

// Lazy load supabaseService to avoid circular dependencies
let supabaseService: any = null
const getSupabaseService = async () => {
  if (!supabaseService) {
    const { supabaseService: service } = await import("@/lib/supabase-service")
    supabaseService = service
  }
  return supabaseService
}

// In-memory cache (per sessie/tab)
const jobPostingsCache: Record<string, any> = {}

export function useJobPostingsCache(params: {
  page?: number
  limit?: number
  search?: string
  status?: string
  region_id?: string | null
  source_id?: string | null
  regio_platform?: string // Add regio_platform filter
}) {
  const cacheKey = JSON.stringify(params)
  const [data, setData] = useState<any>(jobPostingsCache[cacheKey] || null)
  const [loading, setLoading] = useState(!jobPostingsCache[cacheKey])
  const [error, setError] = useState<any>(null)
  const fetchRef = useRef(0)

  const fetchJobPostings = async () => {
    setLoading(true)
    setError(null)
    fetchRef.current++
    const thisFetch = fetchRef.current
    try {
      const service = await getSupabaseService()
      const result = await service.getJobPostings(params)
      jobPostingsCache[cacheKey] = result
      if (thisFetch === fetchRef.current) {
        setData(result)
        setLoading(false)
      }
    } catch (e) {
      if (thisFetch === fetchRef.current) {
        setError(e)
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!jobPostingsCache[cacheKey]) {
      fetchJobPostings()
    } else {
      setData(jobPostingsCache[cacheKey])
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  const refetch = () => {
    fetchJobPostings()
  }

  return { data, loading, error, refetch }
} 