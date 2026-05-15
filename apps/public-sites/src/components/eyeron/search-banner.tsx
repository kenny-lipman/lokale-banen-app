'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchBannerProps {
  /** Regio-naam in de h1 - wordt accent-gekleurd (secondary). */
  region: string
  /** Aantal open vacatures voor de pill rechtsboven. */
  jobCount?: number | null
  /** Pre-fill de input met deze waarde. */
  defaultQuery?: string
  /** Form action - default `/`. */
  formAction?: string
  className?: string
}

const SUGGEST_DEBOUNCE_MS = 180
const MIN_CHARS = 2

/**
 * Donker primary-banner met h1 + "X open posities"-pill + zoek-input
 * met autosuggesties (debounced /api/search/suggest call). Submitted
 * naar `formAction` met `?q=...` query.
 *
 * Toetsenbordnavigatie:
 * - ArrowDown/Up: highlight suggestie
 * - Enter: submit met huidige query (of geselecteerde suggestie)
 * - Escape: sluit dropdown
 */
export function SearchBanner({
  region,
  jobCount,
  defaultQuery,
  formAction = '/',
  className,
}: SearchBannerProps) {
  const [query, setQuery] = useState(defaultQuery ?? '')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIdx, setHighlightedIdx] = useState(-1)
  const formRef = useRef<HTMLFormElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Debounced fetch
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_CHARS) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        )
        if (!res.ok) return
        const data: { suggestions: string[] } = await res.json()
        setSuggestions(data.suggestions)
        setIsOpen(data.suggestions.length > 0)
        setHighlightedIdx(-1)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('[search-suggest] fetch failed', err)
        }
      }
    }, SUGGEST_DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  // Click-outside sluit dropdown
  useEffect(() => {
    if (!isOpen) return
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [isOpen])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIdx((idx) => (idx + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIdx((idx) =>
        idx <= 0 ? suggestions.length - 1 : idx - 1,
      )
    } else if (e.key === 'Enter' && highlightedIdx >= 0) {
      e.preventDefault()
      const picked = suggestions[highlightedIdx]
      setQuery(picked)
      setIsOpen(false)
      // Submit form na state-update
      window.setTimeout(() => formRef.current?.requestSubmit(), 0)
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  function pickSuggestion(s: string) {
    setQuery(s)
    setIsOpen(false)
    window.setTimeout(() => formRef.current?.requestSubmit(), 0)
  }

  return (
    <section
      className={cn(
        'bg-primary px-5 sm:px-10 pt-6 pb-7 sm:pt-7 sm:pb-8',
        className,
      )}
      aria-labelledby="search-title"
    >
      <div className="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 sm:mb-5">
        <h1
          id="search-title"
          className="text-h1 font-regular text-on-dark leading-tight"
        >
          Zoek vacature in <em className="not-italic text-secondary">{region}</em>
        </h1>
        {typeof jobCount === 'number' && jobCount > 0 && (
          <span className="self-start inline-flex items-center h-9 px-4 rounded-pill border border-on-dark text-on-dark text-body whitespace-nowrap">
            {jobCount.toLocaleString('nl-NL')} open posities
          </span>
        )}
      </div>

      <div ref={wrapperRef} className="relative">
        <form
          ref={formRef}
          action={formAction}
          method="GET"
          role="search"
          className="relative h-[51px]"
        >
          <label htmlFor="q" className="sr-only">
            Zoek op functie, bedrijf of plaats
          </label>
          <input
            id="q"
            name="q"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Zoek op functie, bedrijf of plaats"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls="search-suggest-listbox"
            aria-activedescendant={
              highlightedIdx >= 0 ? `search-suggest-${highlightedIdx}` : undefined
            }
            aria-autocomplete="list"
            className="w-full h-[51px] pl-6 pr-16 rounded-input bg-surface text-input text-primary placeholder:text-placeholder outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--secondary)_40%,transparent)]"
          />
          <button
            type="submit"
            aria-label="Zoeken"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-[39px] h-[39px] rounded-full bg-secondary text-secondary-ink inline-flex items-center justify-center hover:bg-secondary-hover active:bg-secondary-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-dark transition-colors"
          >
            <Search className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </form>

        {isOpen && suggestions.length > 0 && (
          <ul
            id="search-suggest-listbox"
            role="listbox"
            className="absolute left-0 right-0 top-[55px] z-20 bg-surface shadow-card-hover rounded-card overflow-hidden"
          >
            {suggestions.map((s, idx) => (
              <li
                key={s}
                id={`search-suggest-${idx}`}
                role="option"
                aria-selected={idx === highlightedIdx}
              >
                <button
                  type="button"
                  onMouseEnter={() => setHighlightedIdx(idx)}
                  onClick={() => pickSuggestion(s)}
                  className={cn(
                    'w-full text-left px-6 py-2.5 text-body font-light text-primary transition-colors',
                    idx === highlightedIdx
                      ? 'bg-primary-tint'
                      : 'hover:bg-primary-tint',
                  )}
                >
                  <Search
                    className="inline-block h-4 w-4 text-body mr-3 align-text-bottom"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
