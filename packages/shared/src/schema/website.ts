/**
 * Build WebSite + SearchAction JSON-LD for Google sitelinks searchbox.
 * Enables the search box that appears directly in Google search results.
 *
 * @see https://schema.org/WebSite
 * @see https://schema.org/SearchAction
 */

export interface WebSiteSchemaInput {
  name: string
  url: string
  description?: string | null
  /** The search URL template. {search_term_string} will be replaced by Google. */
  searchUrlTemplate?: string
}

export interface WebSiteJsonLd {
  '@context': 'https://schema.org'
  '@type': 'WebSite'
  name: string
  url: string
  description?: string
  potentialAction?: {
    '@type': 'SearchAction'
    target: {
      '@type': 'EntryPoint'
      urlTemplate: string
    }
    'query-input': string
  }
}

/**
 * Build a WebSite JSON-LD object with optional SearchAction.
 */
export function buildWebSiteSchema(input: WebSiteSchemaInput): WebSiteJsonLd {
  const schema: WebSiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: input.name,
    url: input.url,
  }

  if (input.description) {
    schema.description = input.description
  }

  const searchTemplate = input.searchUrlTemplate ?? `${input.url}?q={search_term_string}`

  schema.potentialAction = {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: searchTemplate,
    },
    'query-input': 'required name=search_term_string',
  }

  return schema
}
