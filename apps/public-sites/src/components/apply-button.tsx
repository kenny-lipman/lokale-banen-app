'use client'

import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background p-3 sm:static sm:border-0 sm:p-0 sm:mt-6">
        <Button
          size="xl"
          className="w-full sm:w-auto"
          disabled
        >
          {isExpired ? 'Vacature verlopen' : 'Geen sollicitatielink beschikbaar'}
        </Button>
      </div>
    )
  }

  function handleClick() {
    // Track the application click via beacon (non-blocking)
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
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background p-3 shadow-lg sm:static sm:border-0 sm:p-0 sm:mt-6 sm:shadow-none">
      <Button
        size="xl"
        className="w-full sm:w-auto"
        asChild
        onClick={handleClick}
      >
        <a
          href={jobUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Solliciteer
          <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
        </a>
      </Button>
    </div>
  )
}
