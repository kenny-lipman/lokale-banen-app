import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

/**
 * Per-tenant robots.txt with explicit AI crawler allows.
 * Policy: allow search/Q&A bots, disallow training-only bots.
 * @see GEO-ANALYSIS.md section 8
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers()
  const host = headersList.get('x-tenant-host') || 'lokalebanen.nl'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/account/', '/api/'],
      },
      // OpenAI crawlers
      {
        userAgent: 'GPTBot',
        allow: '/',
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: '/',
      },
      {
        userAgent: 'ChatGPT-User',
        allow: '/',
      },
      // Anthropic
      {
        userAgent: 'ClaudeBot',
        allow: '/',
      },
      {
        userAgent: 'anthropic-ai',
        allow: '/',
      },
      // Perplexity
      {
        userAgent: 'PerplexityBot',
        allow: '/',
      },
      // Apple
      {
        userAgent: 'Applebot-Extended',
        allow: '/',
      },
      // Google
      {
        userAgent: 'Googlebot',
        allow: '/',
      },
      {
        userAgent: 'GoogleOther',
        allow: '/',
      },
      // Bing
      {
        userAgent: 'bingbot',
        allow: '/',
      },
      // Training-only bots: disallow
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'Bytespider',
        disallow: '/',
      },
    ],
    sitemap: `https://${host}/sitemap.xml`,
  }
}
