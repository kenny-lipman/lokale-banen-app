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
  platform_id?: string | null
  source_id?: string | null
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
      // Build query string from params
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value))
        }
      })
      
      const response = await fetch(`/api/job-postings?${searchParams.toString()}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch job postings: ${response.statusText}`)
      }
      
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to load job postings')
      }
      
      const formattedResult = {
        data: result.data,
        count: result.count,
        totalPages: result.totalPages
      }
      
      jobPostingsCache[cacheKey] = formattedResult
      if (thisFetch === fetchRef.current) {
        setData(formattedResult)
        setLoading(false)
      }
    } catch (e: any) {
      if (thisFetch === fetchRef.current) {
        const errorMessage = e?.message || 'Unknown error'
        console.error('Error fetching job postings:', {
          message: errorMessage,
          params: params,
          error: e
        })
        setError(new Error(errorMessage))
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