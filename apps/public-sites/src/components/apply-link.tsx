'use client'

import { logApplication } from '@/app/actions/applications'

interface ApplyLinkProps {
  jobUrl: string
  jobId: string
  className?: string
  children: React.ReactNode
}

/**
 * Wraps an external apply link with application tracking.
 * Calls logApplication() fire-and-forget on click (signed-in users only).
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
