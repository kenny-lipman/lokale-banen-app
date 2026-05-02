import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

/**
 * Eyeron breadcrumbs — primary tekst, secondary chevrons. Laatste item
 * (de huidige pagina) is geen link.
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Kruimelpad" className={className}>
      <ol className="flex flex-wrap items-center gap-2 text-meta font-light text-body">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={i} className="inline-flex items-center gap-2">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-primary hover:underline underline-offset-2"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className="text-body">
                  {item.label}
                </span>
              )}
              {!isLast && (
                <ChevronRight
                  className="w-3 h-3 text-secondary shrink-0"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
