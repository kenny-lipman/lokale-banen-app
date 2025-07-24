import { useState, useRef, useEffect } from "react"
import { supabaseService } from "@/lib/supabase-service"

const regionsCache: { data?: any } = {}

export function useRegionsCache() {
  const [data, setData] = useState<any>(regionsCache.data || null)
  const [loading, setLoading] = useState(!regionsCache.data)
  const [error, setError] = useState<any>(null)
  const fetchRef = useRef(0)

  const fetchRegions = async () => {
    setLoading(true)
    setError(null)
    fetchRef.current++
    const thisFetch = fetchRef.current
    try {
      const result = await supabaseService.getRegionsWithJobPostingsCount()
      regionsCache.data = result
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
    if (!regionsCache.data) {
      fetchRegions()
    } else {
      setData(regionsCache.data)
      setLoading(false)
    }
  }, [])

  return {
    data,
    loading,
    error,
    refetch: fetchRegions,
  }
} 