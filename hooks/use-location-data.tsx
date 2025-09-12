import { useState, useEffect } from 'react'

export interface LocationCount {
  name: string
  count: number
}

export interface LocationData {
  companyLocations: LocationCount[]
  jobLocations: LocationCount[]
  uniqueCompanyLocations: number
  totalJobPostings: number
  totalLocations: number
}

interface UseLocationDataOptions {
  enabled?: boolean
}

export function useLocationData(
  contactIds: string[],
  options: UseLocationDataOptions = {}
) {
  const [data, setData] = useState<LocationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const { enabled = true } = options
  
  useEffect(() => {
    // Skip if no contacts or disabled
    if (!contactIds.length || !enabled) {
      setData(null)
      return
    }
    
    const fetchLocationData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch('/api/contacts/locations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ contactIds })
        })
        
        if (!response.ok) {
          throw new Error(`Failed to fetch location data: ${response.statusText}`)
        }
        
        const locationData = await response.json()
        setData(locationData)
      } catch (err) {
        console.error('Error fetching location data:', err)
        setError(err instanceof Error ? err : new Error('Unknown error'))
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    
    // Debounce the API call
    const timeoutId = setTimeout(fetchLocationData, 300)
    
    return () => clearTimeout(timeoutId)
  }, [JSON.stringify(contactIds), enabled])
  
  return {
    data,
    loading,
    error,
    refetch: () => {
      if (contactIds.length > 0) {
        // Force refetch by updating state
        setData(null)
        setError(null)
      }
    }
  }
}