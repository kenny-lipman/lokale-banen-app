import { useState, useRef, useEffect } from "react"
import { supabaseService } from "@/lib/supabase-service"

interface Region {
  id: string
  regio_platform: string
  plaats: string
  postcode: string
  created_at: string
}

const activeRegionsCache: { data?: Region[] } = {}

export function useActiveRegions() {
  const [data, setData] = useState<Region[]>(activeRegionsCache.data || [])
  const [loading, setLoading] = useState(!activeRegionsCache.data)
  const [error, setError] = useState<any>(null)
  const fetchRef = useRef(0)

  const fetchActiveRegions = async () => {
    setLoading(true)
    setError(null)
    fetchRef.current++
    const thisFetch = fetchRef.current
    
    try {
      const result = await supabaseService.getActiveRegions()
      activeRegionsCache.data = result
      
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

  const refetch = () => {
    fetchActiveRegions()
  }

  useEffect(() => {
    if (!activeRegionsCache.data) {
      fetchActiveRegions()
    } else {
      setData(activeRegionsCache.data)
      setLoading(false)
    }
  }, [])

  // Clear cache when component unmounts or on explicit refetch
  const clearCache = () => {
    activeRegionsCache.data = undefined
  }

  return {
    data,
    loading,
    error,
    refetch,
    clearCache
  }
}