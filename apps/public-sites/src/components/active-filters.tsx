'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface ActiveFilter {
  paramName: string
  value: string
  label: string
}

interface ActiveFiltersProps {
  filters: ActiveFilter[]
}

/**
 * Active filter chips with dismiss buttons + "Alles wissen" reset.
 */
export function ActiveFilters({ filters }: ActiveFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  if (filters.length === 0) return null

  function removeFilter(paramName: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')

    const current = params.get(paramName)
    if (!current) return

    const values = current.split(',').filter((v) => v !== value)
    if (values.length > 0) {
      params.set(paramName, values.join(','))
    } else {
      params.delete(paramName)
    }

    const qs = params.toString()
    router.push(qs ? `/?${qs}` : '/', { scroll: false })
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString())
    // Keep only search-related params
    const keep = ['q', 'location', 'lat', 'lng']
    const keysToDelete: string[] = []
    params.forEach((_, key) => {
      if (!keep.includes(key)) keysToDelete.push(key)
    })
    keysToDelete.forEach((k) => params.delete(k))

    const qs = params.toString()
    router.push(qs ? `/?${qs}` : '/', { scroll: false })
  }

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
      <div
        className="flex items-center justify-between"
        style={{
          marginBottom: 8,
          fontSize: '0.6875rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-2)',
        }}
      >
        <span>Actieve filters</span>
        <button
          type="button"
          onClick={clearAll}
          style={{
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'var(--primary-dark)',
            textTransform: 'none',
            letterSpacing: 0,
            cursor: 'pointer',
            background: 'transparent',
          }}
        >
          Alles wissen
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={`${f.paramName}-${f.value}`}
            type="button"
            onClick={() => removeFilter(f.paramName, f.value)}
            className="inline-flex items-center gap-1.5 rounded-full"
            style={{
              padding: '5px 10px 5px 9px',
              fontSize: '0.75rem',
              fontWeight: 500,
              background: 'var(--primary-tint)',
              border: '1px solid var(--primary)',
              color: 'var(--primary-dark)',
              cursor: 'pointer',
            }}
          >
            <span>{f.label}</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>×</span>
          </button>
        ))}
      </div>
    </div>
  )
}
