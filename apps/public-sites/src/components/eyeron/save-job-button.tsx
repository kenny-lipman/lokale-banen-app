'use client'

import { useState, useEffect, useTransition } from 'react'
import { useUser } from '@clerk/nextjs'
import { Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveJob, unsaveJob } from '@/app/actions/saved-jobs'

type Variant = 'card-corner' | 'detail'

interface SaveJobButtonProps {
  jobId: string
  initialSaved?: boolean
  variant?: Variant
}

const VARIANT_CLASSES: Record<Variant, string> = {
  'card-corner': cn(
    'min-w-11 min-h-11 px-2.5 py-2.5',
    'text-body hover:text-primary'
  ),
  'detail': cn(
    'min-w-11 min-h-11 px-3 py-3 rounded-button border border-primary',
    'text-primary hover:bg-primary-tint'
  ),
}

/**
 * Bookmark-knop per Eyeron-spec - saved-state in secondary kleur (gevuld).
 * Hergebruikt de bestaande server-actions (`saveJob`/`unsaveJob`) voor
 * signed-in users; localStorage + sign-up prompt voor anonymous.
 *
 * Variants:
 *   - card-corner: 44×44 hit-area top-right van een vacature-card
 *   - detail: pill-button-stijl voor de vacature-detail-pagina
 */
export function SaveJobButton({
  jobId,
  initialSaved = false,
  variant = 'card-corner',
}: SaveJobButtonProps) {
  const { isSignedIn, isLoaded } = useUser()
  const [saved, setSaved] = useState(initialSaved)
  const [isPending, startTransition] = useTransition()
  const [showPrompt, setShowPrompt] = useState(false)

  // Anonymous: sync uit localStorage bij mount + uitloggen
  useEffect(() => {
    if (!isLoaded || isSignedIn) return
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
    setSaved(newSaved)

    if (isSignedIn) {
      startTransition(async () => {
        try {
          if (newSaved) await saveJob(jobId)
          else await unsaveJob(jobId)
        } catch {
          setSaved(!newSaved)
        }
      })
      return
    }

    try {
      const savedJobs: string[] = JSON.parse(
        localStorage.getItem('saved_jobs') || '[]'
      )
      if (newSaved) {
        if (!savedJobs.includes(jobId)) savedJobs.push(jobId)
      } else {
        const idx = savedJobs.indexOf(jobId)
        if (idx > -1) savedJobs.splice(idx, 1)
      }
      localStorage.setItem('saved_jobs', JSON.stringify(savedJobs))
    } catch {
      /* localStorage niet beschikbaar */
    }

    if (newSaved && !showPrompt) {
      setShowPrompt(true)
      setTimeout(() => setShowPrompt(false), 5000)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        aria-label={saved ? 'Verwijder uit opgeslagen' : 'Vacature opslaan'}
        aria-pressed={saved}
        className={cn(
          'inline-flex items-center justify-center transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary focus-visible:outline-offset-[-3px]',
          VARIANT_CLASSES[variant]
        )}
      >
        <Bookmark
          className={cn(
            'h-5 w-5 transition-colors',
            saved && 'text-secondary fill-current'
          )}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>

      {showPrompt && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-surface border border-divider p-3 shadow-card-hover">
          <p className="text-meta text-body font-light leading-snug">
            <a href="/sign-up" className="font-bold text-primary hover:underline">
              Maak een account aan
            </a>{' '}
            om je opgeslagen vacatures permanent te bewaren.
          </p>
        </div>
      )}
    </div>
  )
}
