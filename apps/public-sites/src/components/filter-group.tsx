'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

interface FilterOption {
  value: string
  label: string
  count: number
}

interface FilterGroupProps {
  title: string
  paramName: string
  options: FilterOption[]
  type?: 'checkbox' | 'radio'
  /** Currently active values (from URL) */
  activeValues: string[]
}

/**
 * Collapsible filter group with checkbox or radio options + counts.
 * All state lives in URL searchParams for SEO + shareability.
 */
export function FilterGroup({
  title,
  paramName,
  options,
  type = 'checkbox',
  activeValues,
}: FilterGroupProps) {
  const [isOpen, setIsOpen] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()

  function toggleOption(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    // Reset page when filter changes
    params.delete('page')

    if (type === 'radio') {
      if (activeValues.includes(value)) {
        params.delete(paramName)
      } else {
        params.set(paramName, value)
      }
    } else {
      const current = new Set(activeValues)
      if (current.has(value)) {
        current.delete(value)
      } else {
        current.add(value)
      }
      if (current.size > 0) {
        params.set(paramName, Array.from(current).join(','))
      } else {
        params.delete(paramName)
      }
    }

    const qs = params.toString()
    router.push(qs ? `/?${qs}` : '/', { scroll: false })
  }

  if (options.length === 0) return null

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between"
        style={{
          padding: '11px 16px',
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: 'var(--text)',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          userSelect: 'none',
          cursor: 'pointer',
          background: 'transparent',
        }}
      >
        {title}
        <ChevronDown
          size={14}
          style={{
            color: 'var(--text-muted)',
            flexShrink: 0,
            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {isOpen && (
        <div
          className="flex flex-col gap-px"
          style={{ padding: '2px 10px 12px' }}
        >
          {options.map((opt) => {
            const isChecked = activeValues.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleOption(opt.value)}
                className="flex items-center gap-2.5 rounded-sm transition-colors"
                style={{
                  padding: '5px 6px',
                  fontSize: '0.8125rem',
                  color: isChecked ? 'var(--primary-dark)' : 'var(--text-2)',
                  fontWeight: isChecked ? 500 : 400,
                  cursor: 'pointer',
                  background: 'transparent',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                {/* Check/radio indicator */}
                {type === 'radio' ? (
                  <span
                    className="shrink-0"
                    style={{
                      width: 15,
                      height: 15,
                      border: `1.5px solid ${isChecked ? 'var(--primary)' : 'var(--border-strong)'}`,
                      borderRadius: '50%',
                      position: 'relative',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {isChecked && (
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: 'var(--primary)',
                        }}
                      />
                    )}
                  </span>
                ) : (
                  <span
                    className="shrink-0 grid place-items-center"
                    style={{
                      width: 15,
                      height: 15,
                      border: `1.5px solid ${isChecked ? 'var(--primary)' : 'var(--border-strong)'}`,
                      borderRadius: 3,
                      background: isChecked ? 'var(--primary)' : 'transparent',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    {isChecked && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                )}

                <span className="flex-1 min-w-0 truncate">{opt.label}</span>

                <span
                  className="font-mono shrink-0"
                  style={{
                    marginLeft: 'auto',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  {opt.count}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
