import { HUB_BRAND } from '../brand'

/**
 * Build an Organization JSON-LD schema for a spoke (regional) site.
 * Includes parentOrganization linking to the hub brand entity.
 *
 * @see GEO-ANALYSIS.md section 12 for the hub-and-spoke brand model
 */

export interface OrganizationSchemaInput {
  name: string
  url: string
  logo?: string | null
  description?: string | null
  areaServed: {
    name: string
    province?: string | null
  }
}

export interface OrganizationJsonLd {
  '@context': 'https://schema.org'
  '@type': 'Organization'
  name: string
  url: string
  logo?: string
  description?: string
  parentOrganization: {
    '@type': 'Organization'
    name: string
    url: string
    sameAs: readonly string[]
  }
  areaServed: Record<string, unknown>
}

/**
 * Build an Organization JSON-LD object for a regional site.
 */
export function buildOrganizationSchema(input: OrganizationSchemaInput): OrganizationJsonLd {
  const areaServed: Record<string, unknown> = {
    '@type': 'AdministrativeArea',
    name: input.areaServed.name,
  }

  if (input.areaServed.province) {
    areaServed.containedInPlace = {
      '@type': 'AdministrativeArea',
      name: input.areaServed.province,
    }
  }

  const schema: OrganizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.name,
    url: input.url,
    parentOrganization: {
      '@type': 'Organization',
      name: HUB_BRAND.name,
      url: HUB_BRAND.url,
      sameAs: HUB_BRAND.sameAs,
    },
    areaServed,
  }

  if (input.logo) {
    schema.logo = input.logo
  }

  if (input.description) {
    schema.description = input.description
  }

  return schema
}
