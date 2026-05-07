import useSWR from "swr"
import { supabaseService } from "@/lib/supabase-service"
import { swrKeys } from "@/lib/swr-keys"

interface Region {
  id: string
  regio_platform: string
  plaats: string
  postcode: string | null
  created_at: string | null
  is_active?: boolean | null
  platform_id?: string | null
}

export function useActiveRegions() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Region[]>(
    swrKeys.activeRegions,
    async () => (await supabaseService.getActiveRegions()) as unknown as Region[],
  )

  return {
    data: data ?? [],
    loading: isLoading,
    isValidating,
    error,
    refetch: () => mutate(),
    mutate,
  }
}
