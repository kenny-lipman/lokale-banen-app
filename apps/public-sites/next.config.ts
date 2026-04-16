import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  // cacheComponents: true,  // disabled — re-enable after full RSC audit
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async rewrites() {
    return [
      // IndexNow key-file serving: /{uuid}.txt → /api/indexnow-key/{uuid}
      // UUID-strict pattern — does NOT conflict with robots.txt / sitemap.xml
      // (those are non-UUID filenames served by Next metadata routes).
      {
        source:
          '/:key([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}).txt',
        destination: '/api/indexnow-key/:key',
      },
    ]
  },
}

const sentryOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT_PUBLIC_SITES || process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  disableLogger: true,
  automaticVercelMonitors: false,
}

const shouldWrapSentry =
  Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) &&
  Boolean(process.env.SENTRY_AUTH_TOKEN)

export default shouldWrapSentry
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig
