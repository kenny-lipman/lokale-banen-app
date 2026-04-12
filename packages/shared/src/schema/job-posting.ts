/**
 * Build a complete JSON-LD JobPosting schema following Google's requirements.
 * All required fields for Google Jobs inclusion are included:
 * - title, description, datePosted, validThrough
 * - hiringOrganization with sameAs, logo, KvK identifier
 * - jobLocation with PostalAddress + GeoCoordinates
 * - baseSalary, directApply, identifier, applicantLocationRequirements
 *
 * @see https://schema.org/JobPosting
 * @see GEO-ANALYSIS.md section 6 for the complete schema specification
 */

export interface JobPostingSchemaInput {
  title: string
  description: string
  datePosted: string
  validThrough: string
  employmentType?: string
  hiringOrganization: {
    name: string
    sameAs?: string[]
    logo?: string | null
    kvkNumber?: string | null
  }
  jobLocation: {
    streetAddress?: string | null
    city: string
    postalCode?: string | null
    region?: string | null
    country?: string
    latitude?: number | null
    longitude?: number | null
  }
  salary?: {
    minValue?: number | null
    maxValue?: number | null
    currency?: string
    unitText?: string
  } | null
  directApply: boolean
  identifier: {
    name: string
    value: string
  }
  applicantLocationCountry?: string
}

export interface JobPostingJsonLd {
  '@context': 'https://schema.org'
  '@type': 'JobPosting'
  title: string
  description: string
  datePosted: string
  validThrough: string
  employmentType?: string
  hiringOrganization: Record<string, unknown>
  jobLocation: Record<string, unknown>
  baseSalary?: Record<string, unknown>
  directApply: boolean
  identifier: Record<string, unknown>
  applicantLocationRequirements?: Record<string, unknown>
}

/**
 * Build a JSON-LD JobPosting object ready to be serialized in a <script> tag.
 */
export function buildJobPostingSchema(input: JobPostingSchemaInput): JobPostingJsonLd {
  const hiringOrganization: Record<string, unknown> = {
    '@type': 'Organization',
    name: input.hiringOrganization.name,
  }

  if (input.hiringOrganization.sameAs?.length) {
    hiringOrganization.sameAs = input.hiringOrganization.sameAs
  }

  if (input.hiringOrganization.logo) {
    hiringOrganization.logo = input.hiringOrganization.logo
  }

  if (input.hiringOrganization.kvkNumber) {
    hiringOrganization.identifier = {
      '@type': 'PropertyValue',
      name: 'KvK',
      value: input.hiringOrganization.kvkNumber,
    }
  }

  const address: Record<string, unknown> = {
    '@type': 'PostalAddress',
    addressLocality: input.jobLocation.city,
    addressCountry: input.jobLocation.country ?? 'NL',
  }

  if (input.jobLocation.streetAddress) {
    address.streetAddress = input.jobLocation.streetAddress
  }
  if (input.jobLocation.postalCode) {
    address.postalCode = input.jobLocation.postalCode
  }
  if (input.jobLocation.region) {
    address.addressRegion = input.jobLocation.region
  }

  const jobLocation: Record<string, unknown> = {
    '@type': 'Place',
    address,
  }

  if (input.jobLocation.latitude != null && input.jobLocation.longitude != null) {
    jobLocation.geo = {
      '@type': 'GeoCoordinates',
      latitude: input.jobLocation.latitude,
      longitude: input.jobLocation.longitude,
    }
  }

  const schema: JobPostingJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: input.title,
    description: input.description,
    datePosted: input.datePosted,
    validThrough: input.validThrough,
    hiringOrganization,
    jobLocation,
    directApply: input.directApply,
    identifier: {
      '@type': 'PropertyValue',
      name: input.identifier.name,
      value: input.identifier.value,
    },
  }

  if (input.employmentType) {
    schema.employmentType = input.employmentType
  }

  if (input.salary && (input.salary.minValue != null || input.salary.maxValue != null)) {
    const value: Record<string, unknown> = {
      '@type': 'QuantitativeValue',
      unitText: input.salary.unitText ?? 'MONTH',
    }

    if (input.salary.minValue != null) value.minValue = input.salary.minValue
    if (input.salary.maxValue != null) value.maxValue = input.salary.maxValue

    schema.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: input.salary.currency ?? 'EUR',
      value,
    }
  }

  if (input.applicantLocationCountry) {
    schema.applicantLocationRequirements = {
      '@type': 'Country',
      name: input.applicantLocationCountry,
    }
  }

  return schema
}
