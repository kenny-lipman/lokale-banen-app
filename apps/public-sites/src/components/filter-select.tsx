'use client'

interface FilterSelectProps {
  name: string
  value: string
  options: { label: string; value: string }[]
  isActive: boolean
}

/**
 * Client-side select that auto-submits the parent form on change.
 * Styled as a pill (rounded-[18px]).
 */
export function DesktopFilterSelect({ name, value, options, isActive }: FilterSelectProps) {
  return (
    <select
      name={name}
      defaultValue={value}
      onChange={(e) => {
        const form = e.currentTarget.closest('form')
        if (form) form.submit()
      }}
      className="h-9 px-3 text-meta font-medium rounded-[18px] cursor-pointer transition-colors focus:outline-none focus:border-primary appearance-none pr-8"
      style={{
        border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
        backgroundColor: isActive ? 'var(--primary-light)' : 'var(--surface)',
        color: isActive ? 'var(--primary)' : 'var(--foreground)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
      }}
      aria-label="Filter op dienstverband"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
