/**
 * Generate a URL-safe slug from a job title, city, and UUID.
 * Format: `{title-kebab}-{city-kebab}-{short-id}`
 * where short-id is the first 8 hex chars of the UUID (dashes removed).
 *
 * @example
 * generateSlug('Junior Developer', 'Naaldwijk', '550e8400-e29b-41d4-a716-446655440000')
 * // => 'junior-developer-naaldwijk-550e8400'
 */
export function generateSlug(title: string, city: string | null, id: string): string {
  const titleSlug = slugify(title)
  const citySlug = city ? slugify(city) : 'onbekend'
  const shortId = id.replace(/-/g, '').slice(0, 8)
  return `${titleSlug}-${citySlug}-${shortId}`
}

/**
 * Convert text to a URL-safe kebab-case string.
 * Strips diacritics, removes non-alphanumeric chars, truncates to 80 chars.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

/**
 * Slugify a city name for URL use. Pure text transform, no ID suffix.
 * Deterministic: same input always produces same output.
 *
 * @example
 * slugifyCity('Naaldwijk')    // => 'naaldwijk'
 * slugifyCity("'s-Gravenhage") // => 's-gravenhage' (apostrophe stripped)
 * slugifyCity('Den Haag')     // => 'den-haag'
 */
export function slugifyCity(cityName: string): string {
  return slugify(cityName)
}

/**
 * Generate a URL-safe slug for a company from name + UUID.
 * Format: `{name-kebab}-{short-id}`
 *
 * @example
 * generateCompanySlug('Westland Bloemen B.V.', 'a1b2c3d4-e5f6-...')
 * // => 'westland-bloemen-bv-a1b2c3d4'
 */
export function generateCompanySlug(name: string, id: string): string {
  const nameSlug = slugify(name)
  const shortId = id.replace(/-/g, '').slice(0, 8)
  return `${nameSlug}-${shortId}`
}

/**
 * Extract the 8-char short ID from the end of a slug.
 * Returns null if the slug doesn't end with a valid hex ID.
 *
 * @example
 * extractIdFromSlug('junior-developer-naaldwijk-550e8400')
 * // => '550e8400'
 */
export function extractIdFromSlug(slug: string): string | null {
  const match = slug.match(/([a-f0-9]{8})$/)
  return match ? match[1] : null
}
