import useSWR from "swr"
import { supabaseService } from "@/lib/supabase-service"
import { swrKeys, type CompaniesParams } from "@/lib/swr-keys"

export function useCompaniesCache(params: CompaniesParams) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKeys.companies(params),
    () => supabaseService.getCompanies(params),
  )

  const updateCompanyOptimistically = (companyId: string, updates: Partial<any>) => {
    mutate(
      (current: any) => {
        if (!current?.data) return current
        return {
          ...current,
          data: current.data.map((c: any) =>
            c.id === companyId
              ? { ...c, ...updates, updated_at: new Date().toISOString() }
              : c,
          ),
        }
      },
      { revalidate: false },
    )
  }

  const updateCompaniesOptimistically = (companyIds: string[], updates: Partial<any>) => {
    mutate(
      (current: any) => {
        if (!current?.data) return current
        return {
          ...current,
          data: current.data.map((c: any) =>
            companyIds.includes(c.id)
              ? { ...c, ...updates, updated_at: new Date().toISOString() }
              : c,
          ),
        }
      },
      { revalidate: false },
    )
  }

  const revertOptimisticUpdate = () => mutate()

  return {
    data: data ?? null,
    loading: isLoading,
    isValidating,
    error,
    refetch: () => mutate(),
    mutate,
    updateCompanyOptimistically,
    updateCompaniesOptimistically,
    revertOptimisticUpdate,
  }
}
