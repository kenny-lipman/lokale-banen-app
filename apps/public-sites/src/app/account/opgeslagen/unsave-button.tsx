'use client'

import { useTransition } from 'react'
import { X } from 'lucide-react'
import { unsaveJob } from '@/app/actions/saved-jobs'

interface UnsaveButtonProps {
  jobId: string
}

export function UnsaveButton({ jobId }: UnsaveButtonProps) {
  const [isPending, startTransition] = useTransition()

  function handleUnsave() {
    startTransition(async () => {
      await unsaveJob(jobId)
    })
  }

  return (
    <button
      onClick={handleUnsave}
      disabled={isPending}
      aria-label="Verwijder uit opgeslagen"
      className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
    >
      <X className="h-4 w-4" />
    </button>
  )
}
