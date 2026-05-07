import { preload } from "swr"
import { swrKeys } from "@/lib/swr-keys"
import { supabaseService } from "@/lib/supabase-service"
import { createClient } from "@/lib/supabase"

async function fetchPlatformStats() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("platforms")
    .select("is_active")
    .not("regio_platform", "is", null)
    .not("regio_platform", "eq", "")
  if (error) throw new Error(error.message || "Failed to fetch platform statistics")
  const total = data?.length || 0
  const active = data?.filter((p) => p.is_active === true).length || 0
  return { total, active, inactive: total - active }
}

const prefetchers: Record<string, () => void> = {
  "/dashboard": () => {
    preload(swrKeys.dashboardStats, () => supabaseService.getDashboardStats())
    preload(swrKeys.dashboardContactStats, () => supabaseService.getContactStats())
    preload(swrKeys.dashboardApifyRuns, () => supabaseService.getApifyRuns())
  },
  "/regios": () => {
    preload(swrKeys.regions, () => supabaseService.getCitiesWithJobPostingsCount())
    preload(swrKeys.activeRegions, () => supabaseService.getActiveRegions())
    preload(swrKeys.platformStats, fetchPlatformStats)
  },
  "/instantly-sync": () => {
    preload(swrKeys.instantlyLeads, async () => {
      const res = await fetch("/api/instantly-leads")
      if (!res.ok) throw new Error("Fout bij ophalen leads")
      return res.json()
    })
  },
}

export function prefetchRoute(path: string) {
  prefetchers[path]?.()
}
