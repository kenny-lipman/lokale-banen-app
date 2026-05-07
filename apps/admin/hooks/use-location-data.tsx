import useSWR from "swr"
import { swrKeys } from "@/lib/swr-keys"

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

async function fetchLocationData(contactIds: string[]): Promise<LocationData> {
  const response = await fetch("/api/contacts/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contactIds }),
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch location data: ${response.statusText}`)
  }
  return response.json()
}

export function useLocationData(
  contactIds: string[],
  options: UseLocationDataOptions = {},
) {
  const { enabled = true } = options
  const sortedIds = [...contactIds].sort()
  const shouldFetch = enabled && sortedIds.length > 0

  const { data, error, isLoading, mutate } = useSWR<LocationData>(
    shouldFetch ? swrKeys.contactLocations(sortedIds) : null,
    () => fetchLocationData(sortedIds),
  )

  return {
    data: data ?? null,
    loading: isLoading,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    refetch: () => mutate(),
  }
}
