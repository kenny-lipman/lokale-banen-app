'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { SortOption } from '@/lib/queries'
import { PillButton } from './pill-button'

interface SortToolbarProps {
  /** Aantal resultaten — "Toont X - Y van Z". */
  total: number
  currentPage: number
  pageSize?: number
  /** Huidige sort uit URL. */
  currentSort: SortOption
  /** True als er ?lat=&lng= in URL zit — dan is "Dichtstbij" beschikbaar. */
  hasLocation: boolean
  className?: string
}

interface SortOptionDef {
  value: SortOption
  label: string
}

const SORT_OPTIONS: SortOptionDef[] = [
  { value: 'newest',      label: 'Toon nieuwste eerst' },
  { value: 'oldest',      label: 'Toon oudste eerst' },
  { value: 'salary_desc', label: 'Hoogste salaris eerst' },
  { value: 'nearest',     label: 'Dichtstbij eerst' },
]

/**
 * Sort-toolbar boven de vacature-lijst — count links, sort-pill rechts.
 * Sort-pill opent een mini-popover met opties; selecteren = router.push.
 */
export function SortToolbar({
  total,
  currentPage,
  pageSize = 20,
  currentSort,
  hasLocation,
  className,
}: SortToolbarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)

  // Click-outside + ESC sluit popover
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function selectSort(value: SortOption) {
    setOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'newest') params.delete('sort')
    else params.set('sort', value)
    params.delete('page')
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  const from = (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, total)
  const currentLabel = SORT_OPTIONS.find((o) => o.value === currentSort)?.label
                    ?? 'Toon nieuwste eerst'

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 pt-3 pb-5 ${className ?? ''}`}
    >
      <span
        className="text-meta font-bold text-primary tracking-tight"
        aria-live="polite"
      >
        Toont {from} tot {to} van {total.toLocaleString('nl-NL')} vacatures
      </span>

      <div ref={containerRef} className="relative">
        <PillButton
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {currentLabel}
          <ChevronDownIcon />
        </PillButton>

        {open && (
          <ul
            role="listbox"
            className="absolute right-0 mt-2 z-20 min-w-[220px] bg-surface border border-divider shadow-card-hover py-1"
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
                    className={`w-full text-left px-4 py-2.5 text-meta font-light transition-colors ${
                      selected
                        ? 'bg-primary-tint text-primary font-bold'
                        : 'text-primary hover:bg-primary-tint'
                    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {opt.label}
                    {disabled && (
                      <span className="block text-small font-light text-body mt-0.5">
                        Schakel locatie in
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function ChevronDownIcon() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-secondary shrink-0"
      aria-hidden="true"
    >
      <path d="M18.7071 8.29289C19.0976 8.68342 19.0976 9.31658 18.7071 9.70711L12.7071 15.7071C12.3166 16.0976 11.6834 16.0976 11.2929 15.7071L5.29289 9.70711C4.90237 9.31658 4.90237 8.68342 5.29289 8.29289C5.68342 7.90237 6.31658 7.90237 6.70711 8.29289L12 13.5858L17.2929 8.29289C17.6834 7.90237 18.3166 7.90237 18.7071 8.29289Z" />
    </svg>
  )
}
