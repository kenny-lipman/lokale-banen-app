import { useState, useRef, useEffect } from "react"
import { supabaseService } from "@/lib/supabase-service"

interface ContactsFilters {
  search?: string
  hoofddomein?: string[]
  size?: string[]
  campaign?: 'all' | 'with' | 'without'
  status?: string[]
  source?: string[]
  start?: string[]
  statusCampagne?: string[]
  statusBedrijf?: string[]
}

interface ContactsResult {
  data: any[]
  count: number
  totalPages: number
  currentPage: number
  requestedPage: number
}

export function useContactsPaginated(
  page: number = 1,
  limit: number = 15,
  filters: ContactsFilters = {},
  onPageChange?: (newPage: number) => void
) {
  console.log('useContactsPaginated: Hook called with:', { page, limit, filters })
  
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const [count, setCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(page)
  const fetchRef = useRef(0)

  const fetchContacts = async () => {
    setLoading(true)
    setError(null)
    fetchRef.current++
    const thisFetch = fetchRef.current
    
    try {
      console.log("Fetching paginated contacts with filters:", filters)
      
      // Use optimized search for better performance
      const result = await supabaseService.searchContactsOptimized(page, limit, filters)
      console.log("Successfully fetched paginated contacts:", result?.data?.length || 0, "contacts")
      
      if (thisFetch === fetchRef.current) {
        setData(result?.data || [])
        setCount(result?.count || 0)
        setTotalPages(result?.totalPages || 1)
        setCurrentPage(result?.currentPage || 1)
        
        // Handle automatic page reset when filters reduce total pages
        if (result?.currentPage !== result?.requestedPage && onPageChange) {
          console.log(`Auto-resetting page from ${result.requestedPage} to ${result.currentPage}`)
          onPageChange(result.currentPage)
        }
        
        setLoading(false)
      }
    } catch (e) {
      console.error("Error in fetchContacts:", e)
      const errorMessage = e instanceof Error ? e.message : "Unknown error fetching contacts"
      
      if (thisFetch === fetchRef.current) {
        setError(errorMessage)
        setLoading(false)
        setData([])
      }
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [page, limit, JSON.stringify(filters)])

  return {
    data,
    loading,
    error,
    count,
    totalPages,
    currentPage,
    refetch: fetchContacts,
  }
}

// Optimized hook for contact statistics
export function useContactStats() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await supabaseService.getContactStatsOptimized()
      setStats(result)
    } catch (e) {
      console.error("Error fetching contact stats:", e)
      setError(e instanceof Error ? e.message : "Unknown error")
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
    refetch: fetchStats,
  }
} 