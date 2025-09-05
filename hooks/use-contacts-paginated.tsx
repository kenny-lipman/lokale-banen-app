import { useState, useRef, useEffect } from "react"
import { supabaseService } from "@/lib/supabase-service"

interface ContactsFilters {
  search?: string
  inCampaign?: string
  hasEmail?: string
  companyStatus?: string
  companyStart?: string
  companySize?: string
  categoryStatus?: string
  status?: string
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
    console.log('fetchContacts called - refetching data...')
    setLoading(true)
    setError(null)
    fetchRef.current++
    const thisFetch = fetchRef.current
    
    try {
      console.log("Fetching contacts from API with filters:", filters)
      
      // Build query parameters
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', limit.toString())
      
      if (filters.search) params.append('search', filters.search)
      if (filters.inCampaign) params.append('inCampaign', filters.inCampaign)
      if (filters.hasEmail) params.append('hasEmail', filters.hasEmail)
      if (filters.companyStatus) params.append('companyStatus', filters.companyStatus)
      if (filters.companyStart) params.append('companyStart', filters.companyStart)
      if (filters.companySize) params.append('companySize', filters.companySize)
      if (filters.categoryStatus) params.append('categoryStatus', filters.categoryStatus)
      if (filters.status) params.append('status', filters.status)
      
      const response = await fetch(`/api/contacts?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      console.log("Successfully fetched contacts from API:", result?.data?.length || 0, "contacts")
      
      if (thisFetch === fetchRef.current) {
        setData(result?.data || [])
        setCount(result?.count || 0)
        setTotalPages(result?.totalPages || 1)
        setCurrentPage(page)
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