import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbLink {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbLink[]
}

/**
 * Visual breadcrumb navigation. Last item is rendered as plain text (current page).
 * Pairs with BreadcrumbList JSON-LD for rich results.
 */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav
      className="flex items-center gap-1 text-meta min-w-0 overflow-hidden"
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <span key={index} className="flex items-center gap-1 min-w-0">
            {index > 0 && (
              <ChevronRight
                className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                aria-hidden="true"
              />
            )}
            {isLast || !item.href ? (
              <span className="text-foreground font-medium truncate">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-muted hover:text-primary transition-colors shrink-0"
              >
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
