import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'

interface ApifyRun {
  id: string
  actor_id: string
  started_at: string
  finished_at?: string
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED'
  user_id: string
  created_at: string
  session_id?: string
  session_name: string
  job_count: number
  company_count: number
  scraping_status: string
}

interface UseApifyRunsOptions {
  limit?: number
  search?: string
  status?: string
  autoFetch?: boolean
}

interface UseApifyRunsReturn {
  runs: ApifyRun[]
  loading: boolean
  error: string | null
  total: number
  hasMore: boolean
  fetchRuns: (options?: { offset?: number; search?: string; status?: string }) => Promise<void>
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
}

export function useApifyRuns(options: UseApifyRunsOptions = {}): UseApifyRunsReturn {
  const { limit = 50, search = '', status = '', autoFetch = true } = options
  const { toast } = useToast()
  
  const [runs, setRuns] = useState<ApifyRun[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const fetchRuns = useCallback(async (fetchOptions?: { offset?: number; search?: string; status?: string }) => {
    const fetchOffset = fetchOptions?.offset ?? 0
    const fetchSearch = fetchOptions?.search ?? search
    const fetchStatus = fetchOptions?.status ?? status
    
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: fetchOffset.toString(),
        ...(fetchSearch && { search: fetchSearch }),
        ...(fetchStatus && { status: fetchStatus })
      })

      const response = await fetch(`/api/otis/apify-runs?${params}`)
      const result = await response.json()

      if (result.success) {
        if (fetchOffset === 0) {
          // First page - replace data
          setRuns(result.data.runs)
        } else {
          // Subsequent pages - append data
          setRuns(prev => [...prev, ...result.data.runs])
        }
        
        setTotal(result.data.total)
        setHasMore(result.data.has_more)
        setOffset(fetchOffset + result.data.runs.length)
      } else {
        throw new Error(result.error || 'Failed to fetch apify runs')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch apify runs'
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [limit, search, status, toast])

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return
    await fetchRuns({ offset })
  }, [hasMore, loading, offset, fetchRuns])

  const refresh = useCallback(async () => {
    setOffset(0)
    await fetchRuns({ offset: 0 })
  }, [fetchRuns])

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch) {
      setOffset(0)
      fetchRuns({ offset: 0 })
    }
  }, [autoFetch, search, status, fetchRuns])

  return {
    runs,
    loading,
    error,
    total,
    hasMore,
    fetchRuns,
    loadMore,
    refresh
  }
} 