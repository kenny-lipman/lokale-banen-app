/**
 * Hub brand constants for the Lokale Banen Netwerk.
 * Used in Organization JSON-LD, footer links, and brand attribution.
 *
 * Every spoke site (WestlandseBanen, GroningseBanen, etc.) references this
 * hub entity via parentOrganization in their JSON-LD.
 */
export const HUB_BRAND = {
  name: 'Lokale Banen Netwerk',
  url: 'https://lokalebanen.nl',
  sameAs: [
    'https://www.linkedin.com/company/lokale-banen-netwerk',
  ],
} as const

export type HubBrand = typeof HUB_BRAND
