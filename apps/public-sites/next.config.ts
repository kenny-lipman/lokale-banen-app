import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // TODO: re-enable cacheComponents after build is stable
  // cacheComponents: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
}

export default nextConfig
