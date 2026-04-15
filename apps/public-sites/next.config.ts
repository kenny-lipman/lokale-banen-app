import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
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

export default nextConfig
