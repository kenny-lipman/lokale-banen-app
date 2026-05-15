'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Radio } from './radio'
import { Checkbox } from './checkbox'

interface FilterOption {
  value: string
  label: string
  count?: number
}

interface FilterGroupProps {
  /** Heading boven de groep, bv. "Afstand" of "Dienstverband". */
  label: string
  /** URL-parameter naam, bv. "type", "hours", "education", "sector", "distance". */
  paramName: string
  /** "radio" = single value, "checkbox" = comma-separated multiple values. */
  type: 'radio' | 'checkbox'
  options: FilterOption[]
  /** Geactiveerde waarden uit URL - voor radio max 1, voor checkbox 0..N. */
  activeValues: string[]
}

/**
 * Eén filter-groep met label + radio/checkbox opties. URL is de single source
 * of truth - elke change triggert een `router.push` naar dezelfde pagina met
 * bijgewerkte queryparams. Pagina re-renderet server-side met nieuwe filter.
 *
 * `useTransition` houdt de UI responsief tijdens server-re-render.
 */
export function FilterGroup({
  label,
  paramName,
  type,
  options,
  activeValues,
}: FilterGroupProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  function toggleValue(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page') // reset pagination bij filter-change

    if (type === 'radio') {
      if (activeValues.includes(value)) {
        params.delete(paramName)
      } else {
        params.set(paramName, value)
      }
    } else {
      const current = new Set(activeValues)
      if (current.has(value)) current.delete(value)
      else current.add(value)
      if (current.size === 0) params.delete(paramName)
      else params.set(paramName, [...current].join(','))
    }

    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <fieldset className="relative border-0 min-w-0 mt-6 pt-0 pb-0 first:mt-0">
      {/* Divider - pseudo-element omdat <legend> de fieldset border-top afdekt */}
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px bg-divider first:hidden"
      />
      <legend className="block w-full p-0 ml-0 text-body font-medium text-primary tracking-tight leading-tight mb-2">
        {label}
      </legend>
      <div className="flex flex-col">
        {options.map((opt) => {
          const checked = activeValues.includes(opt.value)
          if (type === 'radio') {
            return (
              <Radio
                key={opt.value}
                name={paramName}
                value={opt.value}
                checked={checked}
                onChange={() => toggleValue(opt.value)}
              >
                {opt.label}
                {typeof opt.count === 'number' && opt.count > 0 && (
                  <span className="ml-1 text-muted/70">({opt.count})</span>
                )}
              </Radio>
            )
          }
          return (
            <Checkbox
              key={opt.value}
              name={paramName}
              value={opt.value}
              checked={checked}
              onChange={() => toggleValue(opt.value)}
            >
              {opt.label}
              {typeof opt.count === 'number' && opt.count > 0 && (
                <span className="ml-1 text-muted/70">({opt.count})</span>
              )}
            </Checkbox>
          )
        })}
      </div>
    </fieldset>
  )
}
