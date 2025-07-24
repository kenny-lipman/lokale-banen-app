import { useState, useRef, useEffect } from "react"
import { supabaseService } from "@/lib/supabase-service"

const contactsCache: { data?: any } = {} // v2.3: Fixed klant_status->status mapping, removed non-existent columns

export function useContactsCache() {
  const [data, setData] = useState<any>(contactsCache.data || null)
  const [loading, setLoading] = useState(!contactsCache.data)
  const [error, setError] = useState<any>(null)
  const fetchRef = useRef(0)

  const fetchContacts = async () => {
    setLoading(true)
    setError(null)
    fetchRef.current++
    const thisFetch = fetchRef.current
    
    try {
      console.log("Fetching contacts from SupabaseService...")
      const result = await supabaseService.getContacts()
      console.log("Successfully fetched contacts:", result?.length || 0, "contacts")
      
      contactsCache.data = result
      if (thisFetch === fetchRef.current) {
        setData(result)
        setLoading(false)
      }
    } catch (e) {
      console.error("Error in fetchContacts:", e)
      const errorMessage = e instanceof Error ? e.message : "Unknown error fetching contacts"
      
      if (thisFetch === fetchRef.current) {
        setError(errorMessage)
        setLoading(false)
        // Fallback to empty array instead of null to prevent crashes
        setData([])
      }
    }
  }

  useEffect(() => {
    if (!contactsCache.data) {
      fetchContacts()
    } else {
      setData(contactsCache.data)
      setLoading(false)
    }
  }, [])

  return {
    data,
    loading,
    error,
    refetch: fetchContacts,
  }
} 