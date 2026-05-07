"use client"

import useSWR from "swr"
import { createClient } from "@/lib/supabase"
import { swrKeys } from "@/lib/swr-keys"

interface PlatformStats {
  total: number
  active: number
  inactive: number
}

async function fetchPlatformStats(): Promise<PlatformStats> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("platforms")
    .select("is_active")
    .not("regio_platform", "is", null)
    .not("regio_platform", "eq", "")

  if (error) {
    throw new Error(error.message || "Failed to fetch platform statistics")
  }

  const total = data?.length || 0
  const active = data?.filter((p) => p.is_active === true).length || 0
  return { total, active, inactive: total - active }
}

export function usePlatformStats() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<PlatformStats>(
    swrKeys.platformStats,
    fetchPlatformStats,
  )

  return {
    stats: data ?? null,
    loading: isLoading,
    isValidating,
    error: error ? (error.message ?? "Failed to fetch platform statistics") : null,
    refetch: () => mutate(),
    mutate,
  }
}
