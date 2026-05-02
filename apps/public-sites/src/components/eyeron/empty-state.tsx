import { SearchX } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  body?: string
  /** Optionele actie (bv. een PillButton). */
  action?: React.ReactNode
}

/**
 * Generieke empty-state voor wanneer een lijst geen resultaten heeft.
 * Gebruikt als fallback in JobList wanneer filters niets matchen, of in
 * andere route-componenten zoals /account/opgeslagen.
 */
export function EmptyState({
  title = 'Geen vacatures gevonden',
  body = 'Probeer minder filters of een bredere zoekterm — er komen dagelijks nieuwe vacatures bij.',
  action,
}: EmptyStateProps) {
  return (
    <div className="bg-surface px-8 py-12 flex flex-col items-center text-center gap-3">
      <SearchX className="w-10 h-10 text-body" strokeWidth={1.5} aria-hidden="true" />
      <h3 className="text-h2 font-regular text-primary m-0">{title}</h3>
      <p className="text-meta font-light text-body max-w-[50ch] m-0">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
