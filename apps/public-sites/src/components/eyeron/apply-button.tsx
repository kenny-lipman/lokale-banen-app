'use client'

import { ExternalLink } from 'lucide-react'
import { logApplication } from '@/app/actions/applications'
import { cn } from '@/lib/utils'
import { PillButton } from './pill-button'

interface ApplyButtonProps {
  jobUrl: string | null
  jobId: string
  jobTitle: string
  isExpired?: boolean
  /**
   * "sticky-mobile" = sticky bottom bar op <lg (mobile + tablet, default).
   * "inline" = inline button (gebruik op detail-page sidebar).
   */
  variant?: 'sticky-mobile' | 'inline'
}

/**
 * Solliciteer-CTA. Standaard sticky-bottom op mobile (toegankelijk uit elke
 * scroll-positie). Inline-variant voor de desktop-sidebar.
 *
 * Disabled state bij verlopen vacature of ontbrekende sollicitatielink.
 */
export function ApplyButton({
  jobUrl,
  jobId,
  isExpired,
  variant = 'sticky-mobile',
}: ApplyButtonProps) {
  function handleClick() {
    logApplication(jobId).catch((err) => {
      console.error('Failed to log application:', err)
    })
  }

  const disabled = !jobUrl || isExpired
  const buttonLabel = isExpired
    ? 'Vacature verlopen'
    : !jobUrl
    ? 'Geen sollicitatielink'
    : 'Solliciteer direct'

  if (variant === 'inline') {
    return disabled ? (
      <PillButton type="button" disabled size="lg" className="w-full">
        {buttonLabel}
      </PillButton>
    ) : (
      <PillButton
        href={jobUrl as string}
        variant="primary"
        size="lg"
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="w-full"
      >
        {buttonLabel}
        <ExternalLink className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </PillButton>
    )
  }

  // sticky-mobile (mobile + tablet, vervalt op desktop waar sidebar de CTA toont)
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 bg-surface p-3 lg:hidden',
        'border-t border-divider shadow-card-hover'
      )}
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      {disabled ? (
        <PillButton type="button" disabled size="lg" className="w-full">
          {buttonLabel}
        </PillButton>
      ) : (
        <PillButton
          href={jobUrl as string}
          variant="primary"
          size="lg"
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="w-full"
        >
          {buttonLabel}
          <ExternalLink className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </PillButton>
      )}
    </div>
  )
}
