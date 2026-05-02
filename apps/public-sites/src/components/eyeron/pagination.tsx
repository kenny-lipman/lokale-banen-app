import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  currentPage: number
  totalPages: number
  /** Base path zonder ?page param. */
  basePath: string
  /** Extra search-params om te behouden. */
  searchParams?: Record<string, string>
  className?: string
}

/**
 * Server-rendered pagination per Eyeron-stijl — geen border-radius op pill,
 * primary outline-stijl, current-page in primary fill. Gebruikt op SEO-
 * paginated routes (/vacatures, /vacatures/[city-slug]) waar URL-pagination
 * de "Nog X tonen"-CTA vervangt.
 */
export function Pagination({
  currentPage,
  totalPages,
  basePath,
  searchParams = {},
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null

  function buildHref(page: number): string {
    const params = new URLSearchParams(searchParams)
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  const pages = getPageNumbers(currentPage, totalPages)

  return (
    <nav
      className={cn(
        'flex items-center justify-center gap-1 py-6',
        className
      )}
      aria-label="Paginering"
    >
      <PageStep
        href={currentPage > 1 ? buildHref(currentPage - 1) : undefined}
        aria-label="Vorige pagina"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </PageStep>

      {pages.map((page, i) =>
        page === '...' ? (
          <span
            key={`ellipsis-${i}`}
            className="inline-flex items-center justify-center min-w-9 h-9 text-meta font-light text-body"
          >
            …
          </span>
        ) : page === currentPage ? (
          <span
            key={page}
            className="inline-flex items-center justify-center min-w-9 h-9 px-3 bg-primary text-primary-ink text-meta font-bold tracking-tight"
            aria-current="page"
          >
            {page}
          </span>
        ) : (
          <Link
            key={page}
            href={buildHref(page as number)}
            className="inline-flex items-center justify-center min-w-9 h-9 px-3 border border-primary text-primary text-meta font-bold tracking-tight hover:bg-primary-tint transition-colors"
          >
            {page}
          </Link>
        )
      )}

      <PageStep
        href={currentPage < totalPages ? buildHref(currentPage + 1) : undefined}
        aria-label="Volgende pagina"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </PageStep>
    </nav>
  )
}

function PageStep({
  href,
  children,
  ...rest
}: {
  href?: string
  children: React.ReactNode
} & Pick<React.AriaAttributes, 'aria-label'>) {
  const cls =
    'inline-flex items-center justify-center min-w-11 h-11 px-3 transition-colors'
  if (!href) {
    return (
      <span className={cn(cls, 'text-body opacity-40')} {...rest}>
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      className={cn(cls, 'text-primary hover:bg-primary-tint')}
      {...rest}
    >
      {children}
    </Link>
  )
}

/** Page-numbers met ellipsis voor grote sets. */
function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}
