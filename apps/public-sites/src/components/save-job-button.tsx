'use client'

import { useState, useEffect, useTransition } from 'react'
import { useUser } from '@clerk/nextjs'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveJob, unsaveJob } from '@/app/actions/saved-jobs'

interface SaveJobButtonProps {
  jobId: string
  initialSaved?: boolean
}

/**
 * Heart icon toggle for saving jobs.
 * Signed-in users: persists to DB via server actions.
 * Anonymous users: localStorage + signup prompt.
 */
export function SaveJobButton({
  jobId,
  initialSaved = false,
}: SaveJobButtonProps) {
  const { isSignedIn, isLoaded } = useUser()
  const [saved, setSaved] = useState(initialSaved)
  const [isPending, startTransition] = useTransition()
  const [showPrompt, setShowPrompt] = useState(false)

  // For anonymous users: sync with localStorage on mount (and on sign-out)
  useEffect(() => {
    if (!isLoaded || isSignedIn) return // signed-in users get initialSaved from server
    try {
      const raw = localStorage.getItem('saved_jobs')
      const jobs = raw ? (JSON.parse(raw) as string[]) : []
      setSaved(jobs.includes(jobId))
    } catch {
      setSaved(false)
    }
  }, [jobId, isSignedIn, isLoaded])

  function handleToggle() {
    const newSaved = !saved
    setSaved(newSaved) // optimistic update

    if (isSignedIn) {
      // Persist to database via server action
      startTransition(async () => {
        try {
          if (newSaved) {
            await saveJob(jobId)
          } else {
            await unsaveJob(jobId)
          }
        } catch {
          setSaved(!newSaved) // revert on error
        }
      })
    } else {
      // Anonymous: localStorage only
      try {
        const savedJobs: string[] = JSON.parse(
          localStorage.getItem('saved_jobs') || '[]'
        )
        if (newSaved) {
          if (!savedJobs.includes(jobId)) savedJobs.push(jobId)
        } else {
          const index = savedJobs.indexOf(jobId)
          if (index > -1) savedJobs.splice(index, 1)
        }
        localStorage.setItem('saved_jobs', JSON.stringify(savedJobs))
      } catch {
        // localStorage not available
      }

      // Show sign-up prompt for anonymous users
      if (newSaved && !showPrompt) {
        setShowPrompt(true)
        setTimeout(() => setShowPrompt(false), 5000)
      }
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        disabled={isPending}
        aria-label={saved ? 'Verwijder uit opgeslagen' : 'Vacature opslaan'}
        className="inline-flex items-center justify-center h-10 w-10 rounded-md text-muted hover:text-foreground hover:bg-background transition-colors"
      >
        <Heart
          className={cn(
            'h-5 w-5 transition-colors',
            saved
              ? 'fill-red-500 text-red-500'
              : 'text-muted-foreground hover:text-red-400'
          )}
        />
      </button>

      {/* Anonymous save prompt */}
      {showPrompt && (
        <div className="absolute right-0 top-full mt-2 z-50 w-60 rounded-lg border border-border bg-surface p-3 shadow-card-hover">
          <p className="text-meta text-muted-foreground">
            <a href="/sign-up" className="font-medium text-primary hover:underline">
              Maak een account aan
            </a>{' '}
            om je opgeslagen vacatures permanent te bewaren.
          </p>
        </div>
      )}
    </div>
  )
}
