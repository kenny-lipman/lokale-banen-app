/**
 * Build a BreadcrumbList JSON-LD schema for detail pages.
 * Enables breadcrumb rich results in Google search.
 *
 * @see https://schema.org/BreadcrumbList
 */

export interface BreadcrumbItem {
  name: string
  url: string
}

export interface BreadcrumbListJsonLd {
  '@context': 'https://schema.org'
  '@type': 'BreadcrumbList'
  itemListElement: Array<{
    '@type': 'ListItem'
    position: number
    name: string
    item: string
  }>
}

/**
 * Build a BreadcrumbList JSON-LD object from an ordered list of breadcrumb items.
 *
 * @example
 * buildBreadcrumbSchema([
 *   { name: 'Home', url: 'https://westlandsebanen.nl' },
 *   { name: 'Vacatures', url: 'https://westlandsebanen.nl/vacatures' },
 *   { name: 'Junior Developer', url: 'https://westlandsebanen.nl/vacature/junior-dev-abc123' },
 * ])
 */
export function buildBreadcrumbSchema(items: BreadcrumbItem[]): BreadcrumbListJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem' as const,
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}
