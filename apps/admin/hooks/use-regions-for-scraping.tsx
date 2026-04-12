import { useState, useEffect } from 'react'

interface Region {
  id: string
  plaats: string
  postcode: string | null
  regio_platform: string | null
  created_at: string | null
}

export function useRegionsForScraping() {
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRegions = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch('/api/regions')
        const result = await response.json()
        
        if (result.success) {
          setRegions(result.data)
        } else {
          setError(result.error || 'Failed to fetch regions')
        }
      } catch (err) {
        setError('Network error occurred while fetching regions')
        console.error('Error fetching regions:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRegions()
  }, [])

  return {
    regions,
    loading,
    error,
    refetch: () => {
      setLoading(true)
      setError(null)
      fetch('/api/regions')
        .then(response => response.json())
        .then(result => {
          if (result.success) {
            setRegions(result.data)
          } else {
            setError(result.error || 'Failed to fetch regions')
          }
        })
        .catch(err => {
          setError('Network error occurred while fetching regions')
          console.error('Error fetching regions:', err)
        })
        .finally(() => setLoading(false))
    }
  }
} 