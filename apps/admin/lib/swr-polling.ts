import type { SWRConfiguration } from "swr"

/**
 * Shared SWR config voor polling-hooks. Polling doet zijn eigen werk,
 * geen extra fetches op focus, geen dedup (anders blokkeert hij de poll).
 */
export function pollingOptions<TData>(
  refreshInterval: SWRConfiguration<TData>["refreshInterval"],
): SWRConfiguration<TData> {
  return {
    refreshInterval,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 0,
    keepPreviousData: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    errorRetryCount: 3,
    shouldRetryOnError: (err) => {
      const status = (err as any)?.status
      if (status && status >= 400 && status < 500) return false
      return true
    },
  }
}
