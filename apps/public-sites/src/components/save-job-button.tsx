'use client'

import { useState, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SaveJobButtonProps {
  jobId: string
  initialSaved?: boolean
  isSignedIn?: boolean
}

/**
 * Heart icon toggle for saving jobs.
 * Clerk-aware: signed-in users persist to DB, anonymous users use localStorage.
 * Shows a soft prompt for anonymous users to create an account.
 */
export function SaveJobButton({
  jobId,
  initialSaved = false,
  isSignedIn = false,
}: SaveJobButtonProps) {
  const [saved, setSaved] = useState(() => {
    if (initialSaved) return true
    // Check localStorage for anonymous users
    if (typeof window !== 'undefined' && !isSignedIn) {
      const savedJobs = JSON.parse(localStorage.getItem('saved_jobs') || '[]')
      return savedJobs.includes(jobId)
    }
    return false
  })
  const [isPending, startTransition] = useTransition()
  const [showPrompt, setShowPrompt] = useState(false)

  function handleToggle() {
    startTransition(async () => {
      const newSaved = !saved

      if (isSignedIn) {
        // Server action to toggle saved status in DB
        try {
          const response = await fetch('/api/saved-jobs', {
            method: newSaved ? 'POST' : 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId }),
          })
          if (response.ok) {
            setSaved(newSaved)
          }
        } catch {
          // Silently fail, don't disrupt UX
        }
      } else {
        // LocalStorage for anonymous users
        const savedJobs: string[] = JSON.parse(
          localStorage.getItem('saved_jobs') || '[]'
        )
        if (newSaved) {
          savedJobs.push(jobId)
        } else {
          const index = savedJobs.indexOf(jobId)
          if (index > -1) savedJobs.splice(index, 1)
        }
        localStorage.setItem('saved_jobs', JSON.stringify(savedJobs))
        setSaved(newSaved)

        // Show account prompt after first save
        if (newSaved && !showPrompt) {
          setShowPrompt(true)
          setTimeout(() => setShowPrompt(false), 5000)
        }
      }
    })
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        disabled={isPending}
        aria-label={saved ? 'Verwijder uit opgeslagen' : 'Vacature opslaan'}
        className="h-11 w-11"
      >
        <Heart
          className={cn(
            'h-5 w-5 transition-colors',
            saved
              ? 'fill-red-500 text-red-500'
              : 'text-muted-foreground hover:text-red-400'
          )}
        />
      </Button>

      {/* Anonymous save prompt */}
      {showPrompt && !isSignedIn && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border bg-background p-3 shadow-lg">
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
