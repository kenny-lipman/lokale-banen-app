import { useState, useEffect } from "react"

export function useInstantlyLeadsCache() {
  const [data, setData] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)

  const fetchLeads = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/instantly-leads")
      if (!res.ok) throw new Error("Fout bij ophalen leads")
      const leads = await res.json()
      setData(leads)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLeads() }, [])

  return { data, loading, error, refetch: fetchLeads }
} 