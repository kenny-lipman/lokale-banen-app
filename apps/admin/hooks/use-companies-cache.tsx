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
        
        // Better error logging to handle different error types
        if (e instanceof Error) {
          console.error("use-companies-cache: Error message:", e.message)
          console.error("use-companies-cache: Error stack:", e.stack)
        } else if (e && typeof e === 'object') {
          console.error("use-companies-cache: Error details:", Object.keys(e).length > 0 ? e : 'Empty error object')
          try {
            console.error("use-companies-cache: Error JSON:", JSON.stringify(e, null, 2))
          } catch (jsonError) {
            console.error("use-companies-cache: Error cannot be stringified:", e)
          }
        } else {
          console.error("use-companies-cache: Error value:", e, typeof e)
        }
        
        console.error("use-companies-cache: Params used:", JSON.stringify(params, null, 2))
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

  // Optimistic update function for immediate UI updates
  const updateCompanyOptimistically = (companyId: string, updates: Partial<any>) => {
    if (!data || !data.data) return;
    
    const updatedData = {
      ...data,
      data: data.data.map((company: any) =>
        company.id === companyId
          ? { ...company, ...updates, updated_at: new Date().toISOString() }
          : company
      )
    };
    
    // Update cache and state immediately
    companiesCache[cacheKey] = updatedData;
    setData(updatedData);
  };

  // Bulk optimistic update for multiple companies
  const updateCompaniesOptimistically = (companyIds: string[], updates: Partial<any>) => {
    if (!data || !data.data) return;
    
    const updatedData = {
      ...data,
      data: data.data.map((company: any) =>
        companyIds.includes(company.id)
          ? { ...company, ...updates, updated_at: new Date().toISOString() }
          : company
      )
    };
    
    // Update cache and state immediately
    companiesCache[cacheKey] = updatedData;
    setData(updatedData);
  };

  // Revert optimistic update (rollback function)
  const revertOptimisticUpdate = () => {
    // Force refetch to get server state
    fetchCompanies();
  };

  return {
    data,
    loading,
    error,
    refetch: fetchCompanies,
    updateCompanyOptimistically,
    updateCompaniesOptimistically,
    revertOptimisticUpdate,
  }
} 