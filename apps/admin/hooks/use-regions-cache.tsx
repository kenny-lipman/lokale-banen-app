import useSWR from "swr"
import { supabaseService } from "@/lib/supabase-service"
import { swrKeys } from "@/lib/swr-keys"

interface Region {
  id: string
  regio_platform: string
  plaats: string
  postcode: string
  created_at: string
  job_postings_count?: number
}

export function useRegionsCache() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Region[]>(
    swrKeys.regions,
    async () => (await supabaseService.getCitiesWithJobPostingsCount()) as unknown as Region[],
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
