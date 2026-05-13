/**
 * Sitemap-parser voor werkenindekempen.nl.
 *
 * Bron: sitemap-wik-vacancies.xml (dagelijks ververst)
 * Format: standaard XML-sitemap met <loc>+<lastmod> per URL.
 *
 * URL-pattern voor detailpagina: /vacatures/{slug}-{job_id}-{unix_ts}-c{company_id}
 * Listing/category-URLs filteren we eruit.
 */

export const SITEMAP_URL = "https://www.werkenindekempen.nl/sitemap-wik-vacancies.xml";

const DETAIL_URL_RE =
  /^https:\/\/www\.werkenindekempen\.nl\/vacatures\/[a-z0-9-]+-\d+-\d+-c\d+$/;

export interface SitemapEntry {
  url: string;
  lastmod: string;
}

export function parseSitemap(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const re = /<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const url = m[1].trim();
    const lastmod = m[2].trim();
    if (DETAIL_URL_RE.test(url)) {
      entries.push({ url, lastmod });
    }
  }
  return entries;
}

/**
 * Return URLs waarvan lastmod > lastSeenInDb (of die niet in DB voorkomen).
 *
 * lastSeenMap: url → ISO-timestamp van last_seen_in_sitemap uit DB.
 * Lege string ('') wordt behandeld als "nooit gezien".
 */
export function diffFresh(
  all: SitemapEntry[],
  lastSeenMap: Map<string, string>
): SitemapEntry[] {
  return all.filter((e) => {
    const prev = lastSeenMap.get(e.url);
    return !prev || e.lastmod > prev;
  });
}
