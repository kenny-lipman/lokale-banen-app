import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Source_Sans_3 } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { nlNL } from '@clerk/localizations'
import { hexToLightVariant, darkenHex, hexToMutedVariant } from '@/lib/utils'
import { CookieConsent } from '@/components/cookie-consent'
import './globals.css'

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

// Default brand color used during static prerender; the TenantTheme below
// streams in per-tenant overrides at request time without blocking the shell.
const DEFAULT_PRIMARY = '#006B5E'

/**
 * Safely attempt to resolve tenant data.
 * Returns null during static prerendering (/_not-found) when headers() is unavailable.
 */
async function safeTenant() {
  try {
    const { getTenant } = await import('@/lib/tenant')
    return await getTenant()
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await safeTenant()

  return {
    title: {
      default: tenant?.hero_title || 'Lokale Banen',
      template: `%s | ${tenant?.name || 'Lokale Banen'}`,
    },
    description: tenant?.seo_description || 'Vind vacatures bij jou in de buurt',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
  }
}

/**
 * Dynamic theme override component. Streams per-tenant CSS variables into
 * the document head at request time. The static shell ships with
 * DEFAULT_PRIMARY so the page remains useful even before this component
 * resolves.
 */
async function TenantTheme() {
  const tenant = await safeTenant()
  if (!tenant) return null

  const primary = tenant.primary_color || DEFAULT_PRIMARY
  const primaryHover = darkenHex(primary, 0.1)
  const primaryLight = hexToLightVariant(primary, 0.08)
  const primaryMuted = hexToMutedVariant(primary)

  const css = `:root {
  --primary: ${primary};
  --primary-hover: ${primaryHover};
  --primary-light: ${primaryLight};
  --primary-muted: ${primaryMuted};
}`

  return <style dangerouslySetInnerHTML={{ __html: css }} />
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Static shell with default theme vars — safe to prerender.
  const defaultThemeStyle = {
    '--primary': DEFAULT_PRIMARY,
    '--primary-hover': darkenHex(DEFAULT_PRIMARY, 0.1),
    '--primary-light': hexToLightVariant(DEFAULT_PRIMARY, 0.08),
    '--primary-muted': hexToMutedVariant(DEFAULT_PRIMARY),
  } as React.CSSProperties

  return (
    <html lang="nl" className={sourceSans.variable} style={defaultThemeStyle}>
      <head>
        {/* Tenant-specific CSS variables stream in at request time */}
        <Suspense fallback={null}>
          <TenantTheme />
        </Suspense>
      </head>
      <body className="font-sans">
        <ClerkProvider
          localization={nlNL}
          appearance={{
            variables: {
              colorPrimary: DEFAULT_PRIMARY,
              colorText: '#18181B',
              colorInputBackground: '#FFFFFF',
              colorInputText: '#18181B',
              fontFamily: 'var(--font-source-sans)',
              borderRadius: '8px',
            },
          }}
          dynamic
        >
          {children}
          <CookieConsent />
        </ClerkProvider>
      </body>
    </html>
  )
}
