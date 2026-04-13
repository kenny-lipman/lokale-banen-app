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
 */
export function ApplyButton({ jobUrl, isExpired }: ApplyButtonProps) {
  if (isExpired || !jobUrl) {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-surface p-3 sm:hidden"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <button
          disabled
          className="w-full inline-flex items-center justify-center h-12 px-6 rounded-lg bg-background text-muted text-button cursor-not-allowed"
          style={{ border: '1px solid var(--border)' }}
        >
          {isExpired ? 'Vacature verlopen' : 'Geen sollicitatielink beschikbaar'}
        </button>
      </div>
    )
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-surface p-3 shadow-card-hover sm:hidden"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <a
        href={jobUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full inline-flex items-center justify-center h-12 px-6 rounded-lg bg-primary text-primary-foreground text-button transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Solliciteer
        <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  )
}
