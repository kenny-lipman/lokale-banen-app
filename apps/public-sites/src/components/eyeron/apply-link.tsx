'use client'

import { logApplication } from '@/app/actions/applications'

interface ApplyLinkProps {
  jobUrl: string
  jobId: string
  className?: string
  children: React.ReactNode
}

/**
 * Inline solliciteer-link — fire-and-forget logApplication call (alleen voor
 * signed-in users) en daarna externe redirect naar de werkgever-URL.
 * Block redirect niet bij logging-failures.
 */
export function ApplyLink({ jobUrl, jobId, className, children }: ApplyLinkProps) {
  function handleClick() {
    logApplication(jobId).catch((err) => {
      console.error('Failed to log application:', err)
    })
  }

  return (
    <a
      href={jobUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  )
}
