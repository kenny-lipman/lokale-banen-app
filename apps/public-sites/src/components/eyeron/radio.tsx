import * as React from 'react'
import { cn } from '@/lib/utils'

interface RadioProps {
  name: string
  value: string
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  children: React.ReactNode
  className?: string
}

/**
 * Custom radio per Eyeron-spec — 20×20 cirkel, 2px primary border, 13×13
 * gevulde dot binnen bij checked. Native `<input>` is visueel verborgen
 * maar volledig keyboard- en screenreader-toegankelijk.
 *
 * Werkt server-side (presentational) en client-side (met onChange).
 */
export function Radio({
  name,
  value,
  checked,
  defaultChecked,
  onChange,
  children,
  className,
}: RadioProps) {
  return (
    <label
      className={cn(
        'group flex items-center gap-2.5 py-0.5 cursor-pointer min-h-7',
        className
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        className="sr-only peer"
      />
      <span
        aria-hidden="true"
        className={cn(
          'relative inline-flex w-[18px] h-[18px] rounded-full shrink-0',
          'border border-neutral-400 bg-transparent',
          'transition-colors duration-150 ease-eyeron',
          'group-hover:border-primary',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-secondary peer-focus-visible:ring-offset-2',
          'after:content-[""] after:absolute after:inset-1/2 after:-translate-x-1/2 after:-translate-y-1/2',
          'after:w-[10px] after:h-[10px] after:rounded-full after:bg-primary',
          'after:opacity-0 after:transition-opacity after:duration-150',
          'peer-checked:after:opacity-100 peer-checked:border-primary'
        )}
      />
      <span className="text-meta font-light text-neutral-700 leading-snug">
        {children}
      </span>
    </label>
  )
}
