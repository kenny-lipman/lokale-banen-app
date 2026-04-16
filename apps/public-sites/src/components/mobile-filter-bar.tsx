'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, ChevronDown, X, Check } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Nieuwste eerst' },
  { value: 'nearest', label: 'Dichtstbijzijnde', requiresLocation: true },
  { value: 'salary_desc', label: 'Salaris (hoog \u2192 laag)' },
  { value: 'oldest', label: 'Oudste eerst' },
]

interface MobileFilterBarProps {
  activeFilterCount?: number
  currentSort?: string
  hasLocation?: boolean
  children?: React.ReactNode
}

/**
 * Fixed bottom bar for mobile filter/sort access.
 * "Filters" opens a sheet with children content.
 * "Sorteer" opens a sort picker.
 */
export function MobileFilterBar({
  activeFilterCount = 0,
  currentSort = 'newest',
  hasLocation = false,
  children,
}: MobileFilterBarProps) {
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  function selectSort(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'newest') {
      params.delete('sort')
    } else {
      params.set('sort', value)
    }
    params.delete('page')
    const qs = params.toString()
    router.push(qs ? `/?${qs}` : '/', { scroll: false })
    setSortOpen(false)
  }

  const currentLabel = SORT_OPTIONS.find((o) => o.value === currentSort)?.label || 'Nieuwste'

  return (
    <>
      {/* Fixed bottom bar */}
      <div
        className="mobile-filter-bar lg:hidden fixed bottom-0 left-0 right-0 z-50 flex gap-2.5"
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--border-strong)',
          padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -4px 20px rgba(26,24,21,0.07)',
        }}
      >
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg"
          style={{
            minHeight: 48,
            padding: 11,
            background: 'var(--primary)',
            color: 'var(--primary-ink)',
            fontWeight: 600,
            fontSize: '0.9375rem',
          }}
        >
          <SlidersHorizontal size={16} />
          Filters
          {activeFilterCount > 0 && (
            <span
              className="rounded-full font-mono"
              style={{
                fontSize: '0.6875rem',
                padding: '1px 6px',
                background: 'rgba(255,255,255,0.25)',
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSortOpen(true)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg"
          style={{
            minHeight: 48,
            padding: 11,
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border-strong)',
            fontSize: '0.9375rem',
            fontWeight: 500,
          }}
        >
          Sorteer
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Filter sheet */}
      {filterOpen && (
        <SheetOverlay onClose={() => setFilterOpen(false)} title="Filters">
          {children}
        </SheetOverlay>
      )}

      {/* Sort sheet */}
      {sortOpen && (
        <SheetOverlay onClose={() => setSortOpen(false)} title="Sorteer op">
          <div className="flex flex-col" style={{ padding: '8px 0' }}>
            {SORT_OPTIONS.map((opt) => {
              if (opt.requiresLocation && !hasLocation) return null
              const isActive = opt.value === currentSort
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectSort(opt.value)}
                  className="flex items-center gap-3 w-full text-left"
                  style={{
                    padding: '14px 20px',
                    fontSize: '0.9375rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--primary-dark)' : 'var(--text)',
                    background: 'transparent',
                  }}
                >
                  <span className="flex-1">{opt.label}</span>
                  {isActive && <Check size={18} style={{ color: 'var(--primary)' }} />}
                </button>
              )
            })}
          </div>
        </SheetOverlay>
      )}
    </>
  )
}

function SheetOverlay({
  onClose,
  title,
  children,
}: {
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="lg:hidden fixed inset-0 z-[60]"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 overflow-y-auto"
        style={{
          maxHeight: '85vh',
          background: 'var(--surface)',
          borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between sticky top-0 z-10"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid place-items-center rounded-sm"
            style={{ padding: 6, color: 'var(--text-2)' }}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
