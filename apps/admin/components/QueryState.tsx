"use client"

import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface QueryErrorProps {
  message?: string
  onRetry?: () => void
}

export function QueryError({ message, onRetry }: QueryErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-3">
      <AlertCircle className="w-8 h-8 text-red-500" />
      <div>
        <p className="text-sm font-medium text-gray-900">Er ging iets mis bij het laden</p>
        {message ? <p className="text-xs text-gray-500 mt-1 max-w-md">{message}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="w-3.5 h-3.5 mr-2" />
          Opnieuw proberen
        </Button>
      ) : null}
    </div>
  )
}

interface QueryEmptyProps {
  message?: string
}

export function QueryEmpty({ message = "Geen resultaten gevonden" }: QueryEmptyProps) {
  return <div className="text-center py-8 text-gray-500 text-sm">{message}</div>
}
