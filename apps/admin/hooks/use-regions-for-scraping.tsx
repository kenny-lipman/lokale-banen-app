import useSWR from "swr"
import { swrKeys } from "@/lib/swr-keys"

interface Region {
  id: string
  plaats: string
  postcode: string | null
  regio_platform: string | null
  created_at: string | null
}

async function fetchRegions(): Promise<Region[]> {
  const response = await fetch("/api/regions")
  const result = await response.json()
  if (!result.success) {
    throw new Error(result.error || "Failed to fetch regions")
  }
  return result.data
}

export function useRegionsForScraping() {
  const { data, error, isLoading, mutate } = useSWR<Region[]>(
    swrKeys.regionsForScraping,
    fetchRegions,
  )

  return {
    regions: data ?? [],
    loading: isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : "Network error occurred while fetching regions"
      : null,
    refetch: () => mutate(),
  }
}
