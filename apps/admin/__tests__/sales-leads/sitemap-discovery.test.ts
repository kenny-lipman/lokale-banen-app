import { describe, it, expect } from 'vitest'
import {
  parseRobotsForSitemaps,
  parseSitemapXml,
  scoreUrl,
} from '@/lib/services/sales-leads/website/sitemap-discovery'

describe('parseRobotsForSitemaps', () => {
  it('extracts Sitemap: lines case-insensitively', () => {
    const robots = `User-agent: *
Disallow: /admin/
Sitemap: https://example.com/sitemap.xml
SITEMAP: https://example.com/news-sitemap.xml`
    expect(parseRobotsForSitemaps(robots)).toEqual([
      'https://example.com/sitemap.xml',
      'https://example.com/news-sitemap.xml',
    ])
  })

  it('returns empty array when no Sitemap lines', () => {
    expect(parseRobotsForSitemaps('User-agent: *\nDisallow: /')).toEqual([])
  })

  it('dedupes', () => {
    const robots = `Sitemap: https://e.nl/s.xml\nSitemap: https://e.nl/s.xml`
    expect(parseRobotsForSitemaps(robots)).toEqual(['https://e.nl/s.xml'])
  })
})

describe('parseSitemapXml', () => {
  it('extracts urls from urlset', () => {
    const xml = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/contact</loc><lastmod>2025-01-01</lastmod></url>
  <url><loc>https://example.com/about</loc></url>
</urlset>`
    const r = parseSitemapXml(xml)
    expect(r.urls).toEqual([
      'https://example.com/',
      'https://example.com/contact',
      'https://example.com/about',
    ])
    expect(r.childSitemaps).toEqual([])
  })

  it('extracts childSitemaps from sitemap-index', () => {
    const xml = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://e.nl/sitemap-1.xml</loc></sitemap>
  <sitemap><loc>https://e.nl/sitemap-2.xml</loc></sitemap>
</sitemapindex>`
    const r = parseSitemapXml(xml)
    expect(r.urls).toEqual([])
    expect(r.childSitemaps).toEqual([
      'https://e.nl/sitemap-1.xml',
      'https://e.nl/sitemap-2.xml',
    ])
  })

  it('decodes XML entities in URLs', () => {
    const xml = `<urlset><url><loc>https://e.nl/path?a=1&amp;b=2</loc></url></urlset>`
    expect(parseSitemapXml(xml).urls).toEqual(['https://e.nl/path?a=1&b=2'])
  })
})

describe('scoreUrl', () => {
  it('home for root path', () => {
    expect(scoreUrl('https://e.nl/')).toEqual({ role: 'home', priority: 0 })
    expect(scoreUrl('https://e.nl/nl/')).toEqual({ role: 'home', priority: 0 })
  })

  it('contact has highest priority among non-home', () => {
    expect(scoreUrl('https://e.nl/contact')).toEqual({ role: 'contact', priority: 0 })
    expect(scoreUrl('https://e.nl/contact/')).toEqual({ role: 'contact', priority: 0 })
  })

  it('NL + EN keywords for about/team/careers', () => {
    expect(scoreUrl('https://e.nl/over-ons').role).toBe('about')
    expect(scoreUrl('https://e.nl/about-us').role).toBe('about')
    expect(scoreUrl('https://e.nl/team').role).toBe('team')
    expect(scoreUrl('https://e.nl/medewerkers').role).toBe('team')
    expect(scoreUrl('https://e.nl/werken-bij').role).toBe('careers')
    expect(scoreUrl('https://e.nl/careers').role).toBe('careers')
    expect(scoreUrl('https://e.nl/vacatures').role).toBe('careers')
  })

  it('falls back to other with depth-based priority', () => {
    const r1 = scoreUrl('https://e.nl/products/widget')
    expect(r1.role).toBe('other')
    expect(r1.priority).toBeGreaterThanOrEqual(10)
    const r2 = scoreUrl('https://e.nl/products/widget/v2')
    expect(r2.priority).toBeGreaterThan(r1.priority) // diepere paden lagere score
  })

  it('contact ranks above generic page', () => {
    const c = scoreUrl('https://e.nl/contact')
    const o = scoreUrl('https://e.nl/products/widget')
    expect(c.priority).toBeLessThan(o.priority)
  })
})
