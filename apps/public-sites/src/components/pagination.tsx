import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  /** Base path without page param, e.g. "/vacatures/naaldwijk" */
  basePath: string
  /** Additional search params to preserve */
  searchParams?: Record<string, string>
}

/**
 * Server-rendered pagination. No client JS.
 * Shows prev/next + page numbers with ellipsis for large sets.
 */
export function Pagination({ currentPage, totalPages, basePath, searchParams = {} }: PaginationProps) {
  if (totalPages <= 1) return null

  function buildHref(page: number): string {
    const params = new URLSearchParams(searchParams)
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  // Generate page numbers with ellipsis
  const pages = getPageNumbers(currentPage, totalPages)

  return (
    <nav
      className="flex items-center justify-center gap-1 py-4 px-4"
      style={{ borderTop: '1px solid var(--border)' }}
      aria-label="Paginering"
    >
      {/* Previous */}
      {currentPage > 1 ? (
        <Link
          href={buildHref(currentPage - 1)}
          className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
          aria-label="Vorige pagina"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground opacity-40">
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      {/* Page numbers */}
      {pages.map((page, i) =>
        page === '...' ? (
          <span key={`ellipsis-${i}`} className="inline-flex items-center justify-center h-9 w-9 text-meta text-muted-foreground">
            ...
          </span>
        ) : page === currentPage ? (
          <span
            key={page}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-body-medium"
            style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            aria-current="page"
          >
            {page}
          </span>
        ) : (
          <Link
            key={page}
            href={buildHref(page as number)}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-body-medium transition-colors hover:bg-card-hover"
          >
            {page}
          </Link>
        )
      )}

      {/* Next */}
      {currentPage < totalPages ? (
        <Link
          href={buildHref(currentPage + 1)}
          className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
          aria-label="Volgende pagina"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground opacity-40">
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  )
}

/**
 * Generate page number array with ellipsis for large sets.
 * Always shows first, last, and 2 pages around current.
 */
function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | '...')[] = [1]

  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < total - 2) pages.push('...')

  pages.push(total)

  return pages
}
