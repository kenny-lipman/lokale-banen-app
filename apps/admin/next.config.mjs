import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Add experimental features for better performance
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js', 'lucide-react'],
    // Reduce file watcher pressure
    webpackMemoryOptimizations: true,
  },
  // Reduce file watching issues
  onDemandEntries: {
    // Period (in ms) where the page will be kept in memory
    maxInactiveAge: 60 * 1000,
    // Number of pages kept simultaneously without being disposed
    pagesBufferLength: 5,
  },
  // Improve static file serving
  compress: true,
  poweredByHeader: false,
  // Add security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ]
  },
}

const sentryOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
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
