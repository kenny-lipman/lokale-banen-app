'use client'

import { ExternalLink } from 'lucide-react'

interface ApplyButtonProps {
  jobUrl: string | null
  jobTitle: string
  isExpired?: boolean
}

/**
 * Sticky bottom CTA for mobile, inline for desktop.
 * External redirect to the original job posting URL.
 * Tracks clicks via a beacon to avoid blocking navigation.
 */
export function ApplyButton({ jobUrl, jobTitle, isExpired }: ApplyButtonProps) {
  if (isExpired || !jobUrl) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white p-3 sm:static sm:border-0 sm:p-0 sm:mt-6">
        <button
          disabled
          className="w-full sm:w-auto inline-flex items-center justify-center h-12 px-6 rounded-lg bg-muted text-muted-foreground font-semibold text-body cursor-not-allowed"
        >
          {isExpired ? 'Vacature verlopen' : 'Geen sollicitatielink beschikbaar'}
        </button>
      </div>
    )
  }

  function handleClick() {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const data = JSON.stringify({
        jobTitle,
        jobUrl,
        timestamp: new Date().toISOString(),
      })
      navigator.sendBeacon('/api/track-apply', data)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white p-3 shadow-lg sm:static sm:border-0 sm:p-0 sm:mt-6 sm:shadow-none">
      <a
        href={jobUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="w-full sm:w-auto inline-flex items-center justify-center h-12 px-6 rounded-lg bg-primary text-primary-foreground font-semibold text-body transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Solliciteer
        <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  )
}
