import useSWR from "swr"
import { supabaseService } from "@/lib/supabase-service"
import { swrKeys } from "@/lib/swr-keys"

export function useDashboardStats() {
  const { data, error, isLoading, mutate } = useSWR(
    swrKeys.dashboardStats,
    () => supabaseService.getDashboardStats(),
  )
  return { stats: data, loading: isLoading, error, refetch: () => mutate() }
}

export function useDashboardApifyRuns() {
  const { data, error, isLoading, mutate } = useSWR(
    swrKeys.dashboardApifyRuns,
    () => supabaseService.getApifyRuns(),
  )
  return { apifyRuns: data ?? [], loading: isLoading, error, refetch: () => mutate() }
}

export function useDashboardContactStats() {
  const { data, error, isLoading, mutate } = useSWR(
    swrKeys.dashboardContactStats,
    () => supabaseService.getContactStats(),
  )
  return { contactStats: data, loading: isLoading, error, refetch: () => mutate() }
}
