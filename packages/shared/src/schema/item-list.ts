/**
 * Build an ItemList JSON-LD schema for collection pages (city, company).
 * Enables list rich results in Google search.
 *
 * @see https://schema.org/ItemList
 */

export interface ItemListItem {
  name: string
  url: string
}

export interface ItemListSchemaInput {
  name: string
  description?: string
  url: string
  items: ItemListItem[]
  numberOfItems: number
}

export interface ItemListJsonLd {
  '@context': 'https://schema.org'
  '@type': 'ItemList'
  name: string
  description?: string
  url: string
  numberOfItems: number
  itemListElement: Array<{
    '@type': 'ListItem'
    position: number
    name: string
    url: string
  }>
}

export function buildItemListSchema(input: ItemListSchemaInput): ItemListJsonLd {
  const result: ItemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: input.name,
    url: input.url,
    numberOfItems: input.numberOfItems,
    itemListElement: input.items.map((item, index) => ({
      '@type': 'ListItem' as const,
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  }

  if (input.description) {
    result.description = input.description
  }

  return result
}
