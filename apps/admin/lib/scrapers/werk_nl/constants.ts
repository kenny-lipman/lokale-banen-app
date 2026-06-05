/**
 * Constanten voor de werk.nl scraper (UWV publieke vacature-API).
 * Endpoints gereverse-engineerd uit de Angular-zoekapp (publiek, geen DigiD).
 */

export const JOB_SOURCE_NAME = "Werk.nl";

/** Publieke vacaturepagina; eerste GET bootstrapt de anonieme OAM-sessie. */
export const BOOTSTRAP_URL =
  "https://www.werk.nl/nl/vacatures/?friendlyurl=%2Fvacatures";

/** GET hierop zet de XSRF-TOKEN + Antiforgery cookies (respons is 404, dat is OK). */
export const XSRF_URL =
  "https://www.werk.nl/werkzoekenden/mijn-werkmap/kia/publiek/zoekenvacatures";

/** POST zoek-API. */
export const SEARCH_URL =
  "https://www.werk.nl/werkzoekenden/mijn-werkmap/kia/publiek/zoekenvacatures/api/search";

/** GET detail-API (Fase 2). `${DETAIL_URL_BASE}/${referenceNumber}`. */
export const DETAIL_URL_BASE =
  "https://www.werk.nl/werkzoekenden/mijn-werkmap/kia/publiek/zoekenvacatures/api/vacature";

export const PAGE_SIZE = 20; // werk.nl levert vast 20 items per pagina
