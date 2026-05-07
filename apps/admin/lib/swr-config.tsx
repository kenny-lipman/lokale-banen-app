"use client"

import { SWRConfig } from "swr"
import type { ReactNode } from "react"

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 30_000,
        errorRetryCount: 3,
        keepPreviousData: true,
        shouldRetryOnError: (err) => {
          const status = (err as any)?.status
          if (status && status >= 400 && status < 500) return false
          return true
        },
      }}
    >
      {children}
    </SWRConfig>
  )
}
