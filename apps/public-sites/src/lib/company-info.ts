/**
 * Bedrijfsgegevens van LokaleBanen — gedeeld door alle 50+ regio-portalen.
 * Elke handelsnaam ({Portaal}Banen) opereert onder dezelfde rechtspersoon
 * en KvK-registratie. Wordt gerendered op contact-, voorwaarden- en privacy-pagina's.
 */
export const COMPANY_INFO = {
  legalName: 'Lokalebanen',
  kvkNumber: '74807196',
  btwNumber: 'NL860033636B01',
  address: {
    street: 'Slotenmakerstraat 60',
    postalCode: '2671 BV',
    city: 'Naaldwijk',
    country: 'Nederland',
  },
  /** Centrale mailbox — alle contact- en plaatsing-formulieren routeren hierheen
   *  (Kay 12-05-2026). Subject-prefix `[{Portaal}]` zorgt voor traceerbaarheid. */
  centralEmail: 'info@lokalebanen.nl',
} as const

export type CompanyInfo = typeof COMPANY_INFO
