import useSWR from "swr"
import { supabaseService } from "@/lib/supabase-service"
import { swrKeys } from "@/lib/swr-keys"

interface ContactsFilters {
  search?: string
  inCampaign?: string
  hasEmail?: string
  companyStatus?: string
  companyStart?: string
  companySize?: string
  categoryStatus?: string
  status?: string
  pipedriveFilter?: string
  instantlyFilter?: string
  platformId?: string
  dateFrom?: string
  dateTo?: string
}

interface ContactsResponse {
  data: any[]
  count?: number
  totalPages?: number
  pagination?: {
    total: number
    totalPages: number
    isCapped?: boolean
  }
  error?: string
}

async function fetchContacts(
  page: number,
  limit: number,
  filters: ContactsFilters,
): Promise<ContactsResponse> {
  const params = new URLSearchParams()
  params.append("page", page.toString())
  params.append("limit", limit.toString())

  if (filters.search) params.append("search", filters.search)
  if (filters.inCampaign) params.append("inCampaign", filters.inCampaign)
  if (filters.hasEmail) params.append("hasEmail", filters.hasEmail)
  if (filters.companyStatus) params.append("companyStatus", filters.companyStatus)
  if (filters.companyStart) params.append("companyStart", filters.companyStart)
  if (filters.companySize) params.append("companySize", filters.companySize)
  if (filters.categoryStatus) params.append("categoryStatus", filters.categoryStatus)
  if (filters.status) params.append("status", filters.status)
  if (filters.pipedriveFilter) params.append("pipedriveFilter", filters.pipedriveFilter)
  if (filters.instantlyFilter) params.append("instantlyFilter", filters.instantlyFilter)
  if (filters.platformId) params.append("platformId", filters.platformId)
  if (filters.dateFrom) params.append("dateFrom", filters.dateFrom)
  if (filters.dateTo) params.append("dateTo", filters.dateTo)

  const response = await fetch(`/api/contacts?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  const result = (await response.json()) as ContactsResponse
  if (result.error) {
    throw new Error(result.error)
  }
  return result
}

export function useContactsPaginated(
  page: number = 1,
  limit: number = 15,
  filters: ContactsFilters = {},
  _onPageChange?: (newPage: number) => void,
) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<ContactsResponse>(
    swrKeys.contactsPaginated({ page, limit, filters: filters as Record<string, unknown> }),
    () => fetchContacts(page, limit, filters),
  )

  return {
    data: data?.data ?? [],
    loading: isLoading,
    isValidating,
    error: error ? (error instanceof Error ? error.message : "Unknown error fetching contacts") : null,
    count: data?.pagination?.total ?? data?.count ?? 0,
    isCapped: !!data?.pagination?.isCapped,
    totalPages: data?.pagination?.totalPages ?? data?.totalPages ?? 1,
    currentPage: page,
    refetch: () => mutate(),
  }
}

export function useContactStats() {
  const { data, error, isLoading, mutate } = useSWR(
    swrKeys.contactStats,
    () => supabaseService.getContactStatsOptimized(),
  )

  return {
    stats: data ?? null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : "Unknown error") : null,
    refetch: () => mutate(),
  }
}
