import useSWR from "swr"
import { swrKeys } from "@/lib/swr-keys"

async function fetchInstantlyLeads() {
  const res = await fetch("/api/instantly-leads")
  if (!res.ok) {
    throw new Error("Fout bij ophalen leads")
  }
  return res.json()
}

export function useInstantlyLeadsCache() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<any[]>(
    swrKeys.instantlyLeads,
    fetchInstantlyLeads,
  )

  return {
    data: data ?? null,
    loading: isLoading,
    isValidating,
    error,
    refetch: () => mutate(),
    mutate,
  }
}
