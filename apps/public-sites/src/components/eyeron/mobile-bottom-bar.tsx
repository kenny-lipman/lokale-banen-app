'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import type { SortOption } from '@/lib/queries'
import { PillButton } from './pill-button'

interface MobileBottomBarProps {
  /** Inhoud van de filter-drawer (typisch <FilterPanel hideHeading />). */
  filterDrawerContent: React.ReactNode
  /** Aantal actieve filters voor de badge op de Filter-knop. */
  activeFilterCount: number
  /** Total result count voor de "Toon X" CTA in de drawer. */
  resultCount: number
  /** Huidige sort uit URL. */
  currentSort: SortOption
  /** True als ?lat=&lng= in URL - dan is "Dichtstbij" beschikbaar. */
  hasLocation: boolean
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest',      label: 'Toon nieuwste eerst' },
  { value: 'oldest',      label: 'Toon oudste eerst' },
  { value: 'salary_desc', label: 'Hoogste salaris eerst' },
  { value: 'nearest',     label: 'Dichtstbij eerst' },
]

/**
 * Sticky bottom-bar voor mobile/tablet (<lg) - twee pill-buttons:
 *   1. Filters (opent slide-in drawer met FilterPanel-content)
 *   2. Sort (opent een mini-popover met sort-opties)
 *
 * Standaard UX-pattern voor job-boards. Honoreert iOS safe-area-inset.
 */
export function MobileBottomBar({
  filterDrawerContent,
  activeFilterCount,
  resultCount,
  currentSort,
  hasLocation,
}: MobileBottomBarProps) {
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const sortRef = useRef<HTMLDivElement>(null)

  // ESC + body-scroll-lock voor drawer
  useEffect(() => {
    if (!filterOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFilterOpen(false)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [filterOpen])

  // Click-outside voor sort-popover
  useEffect(() => {
    if (!sortOpen) return
    const onClick = (e: MouseEvent) => {
      if (!sortRef.current?.contains(e.target as Node)) setSortOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [sortOpen])

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString())
    for (const k of ['type', 'hours', 'education', 'sector', 'distance', 'page']) {
      params.delete(k)
    }
    startTransition(() => router.push(`?${params.toString()}`, { scroll: false }))
  }

  function selectSort(value: SortOption) {
    setSortOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'newest') params.delete('sort')
    else params.set('sort', value)
    params.delete('page')
    startTransition(() => router.push(`?${params.toString()}`, { scroll: false }))
  }

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === currentSort)?.label ?? 'Sorteer'

  return (
    <>
      <div
        role="region"
        aria-label="Filter en sorteer"
        className="lg:hidden sticky bottom-0 z-20 flex gap-2 px-pad py-2.5 bg-surface border-t border-divider-subtle"
        style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
      >
        <PillButton
          type="button"
          onClick={() => setFilterOpen(true)}
          className="flex-1 justify-center h-12"
          aria-label={`Filters openen${activeFilterCount > 0 ? `, ${activeFilterCount} actief` : ''}`}
        >
          <SlidersHorizontal className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-secondary text-on-dark text-small font-bold">
              {activeFilterCount}
            </span>
          )}
        </PillButton>

        <div ref={sortRef} className="relative flex-1">
          <PillButton
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
            className="w-full justify-center h-12"
          >
            {currentSortLabel}
            <ChevronUpIcon />
          </PillButton>

          {sortOpen && (
            <ul
              role="listbox"
              className="absolute bottom-full mb-2 right-0 left-0 z-30 bg-surface border border-divider shadow-card-hover py-1"
            >
              {SORT_OPTIONS.map((opt) => {
                const disabled = opt.value === 'nearest' && !hasLocation
                const selected = opt.value === currentSort
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={disabled}
                      onClick={() => selectSort(opt.value)}
                      className={`w-full text-left px-4 py-3 text-meta font-light transition-colors ${
                        selected
                          ? 'bg-primary-tint text-primary font-bold'
                          : 'text-primary hover:bg-primary-tint'
                      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {opt.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Filter-drawer ── */}
      <div
        className="fixed inset-0 z-50 lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        aria-hidden={!filterOpen}
        style={{ pointerEvents: filterOpen ? 'auto' : 'none' }}
      >
        <button
          type="button"
          aria-label="Sluit filters"
          onClick={() => setFilterOpen(false)}
          className="absolute inset-0 bg-[rgba(15,23,42,0.45)] transition-opacity duration-200"
          style={{ opacity: filterOpen ? 1 : 0 }}
          tabIndex={filterOpen ? 0 : -1}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-[min(420px,100vw)] bg-surface flex flex-col transition-transform duration-250 ease-eyeron"
          style={{ transform: filterOpen ? 'translateX(0)' : 'translateX(100%)' }}
        >
          <div className="flex items-center justify-between px-5 h-16 border-b border-divider-subtle shrink-0">
            <h2 className="text-h2 font-bold text-primary tracking-tight m-0">
              Filters
            </h2>
            <button
              type="button"
              className="inline-flex items-center justify-center min-w-11 min-h-11 rounded-md text-primary hover:bg-primary-tint"
              aria-label="Sluit filters"
              onClick={() => setFilterOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {filterDrawerContent}
          </div>
          <div className="flex gap-3 px-5 py-4 border-t border-divider-subtle shrink-0">
            <PillButton
              type="button"
              onClick={clearFilters}
              className="flex-1 justify-center"
            >
              Wissen
            </PillButton>
            <PillButton
              type="button"
              variant="primary"
              onClick={() => setFilterOpen(false)}
              className="flex-1 justify-center"
            >
              Toon {resultCount.toLocaleString('nl-NL')} vacatures
            </PillButton>
          </div>
        </div>
      </div>
    </>
  )
}

function ChevronUpIcon() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-secondary shrink-0"
      aria-hidden="true"
    >
      <path d="M5.29289 15.7071C4.90237 15.3166 4.90237 14.6834 5.29289 14.2929L11.2929 8.29289C11.6834 7.90237 12.3166 7.90237 12.7071 8.29289L18.7071 14.2929C19.0976 14.6834 19.0976 15.3166 18.7071 15.7071C18.3166 16.0976 17.6834 16.0976 17.2929 15.7071L12 10.4142L6.70711 15.7071C6.31658 16.0976 5.68342 16.0976 5.29289 15.7071Z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      className="w-6 h-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M6 18L18 6" />
    </svg>
  )
}
