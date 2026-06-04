'use client'

import { useTransition } from 'react'
import { X } from 'lucide-react'
import { unsaveJob } from '@/app/actions/saved-jobs'

interface UnsaveButtonProps {
  jobId: string
}

/**
 * Verwijder-knop voor opgeslagen vacatures. Eyeron-styled met primary
 * hover-tint; subtiel maar duidelijk herkenbaar als destructieve actie.
 */
export function UnsaveButton({ jobId }: UnsaveButtonProps) {
  const [isPending, startTransition] = useTransition()

  function handleUnsave() {
    startTransition(async () => {
      await unsaveJob(jobId)
    })
  }

  return (
    <button
      type="button"
      onClick={handleUnsave}
      disabled={isPending}
      aria-label="Verwijder uit opgeslagen"
      className="inline-flex items-center justify-center min-w-11 min-h-11 text-muted hover:text-primary hover:bg-primary-tint transition-colors shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary focus-visible:outline-offset-[-3px]"
    >
      <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
    </button>
  )
}
