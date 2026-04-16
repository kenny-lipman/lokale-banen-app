import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Source_Sans_3, Newsreader, JetBrains_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { nlNL } from '@clerk/localizations'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { hexToLightVariant, darkenHex, hexToMutedVariant } from '@/lib/utils'
import { buildTenantThemeCss } from '@/lib/theme'
import { CookieConsent } from '@/components/cookie-consent'
import './globals.css'

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

// Editorial display serif — variable optical-size (opsz 6..72) + variable weight 200-800.
// `display: 'optional'` avoids blocking LCP; falls back to system serif until ready.
// NB: when `axes` is set, weight must be 'variable' (or omitted) — not specific values.
const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'optional',
  style: ['normal', 'italic'],
  axes: ['opsz'],
})

// Editorial monospace — used for salary, distance-chip, counts.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'optional',
  weight: ['400', '500'],
})

// Default brand color used during static prerender; the TenantTheme below
// streams in per-tenant overrides at request time without blocking the shell.
const DEFAULT_PRIMARY = '#006B5E'
const DEFAULT_SECONDARY: string | null = null
const DEFAULT_TERTIARY: string | null = null

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

  const css = buildTenantThemeCss({
    primary: tenant.primary_color || DEFAULT_PRIMARY,
    secondary: tenant.secondary_color,
    tertiary: tenant.tertiary_color,
  })

  return (
    <style
      data-tenant-theme={tenant.domain || 'default'}
      dangerouslySetInnerHTML={{ __html: css }}
    />
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Static shell with default theme vars — safe to prerender.
  // Uses the paper/warm-neutral fallbacks from theme.ts so the shell already
  // honours the editorial palette before tenant data streams in.
  const defaultThemeStyle: React.CSSProperties = {
    '--primary': DEFAULT_PRIMARY,
    '--primary-hover': darkenHex(DEFAULT_PRIMARY, 0.1),
    '--primary-light': hexToLightVariant(DEFAULT_PRIMARY, 0.08),
    '--primary-tint': hexToLightVariant(DEFAULT_PRIMARY, 0.08),
    '--primary-muted': hexToMutedVariant(DEFAULT_PRIMARY),
    '--primary-dark': darkenHex(DEFAULT_PRIMARY, 0.25),
  } as React.CSSProperties

  const fontVars = [
    sourceSans.variable,
    newsreader.variable,
    jetbrainsMono.variable,
  ].join(' ')

  return (
    <html lang="nl" className={fontVars} style={defaultThemeStyle}>
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
              colorText: '#1A1815',
              colorInputBackground: '#FFFFFF',
              colorInputText: '#1A1815',
              fontFamily: 'var(--font-body)',
              borderRadius: '8px',
            },
            elements: {
              headerSubtitle: { display: 'none' },
            },
          }}
          dynamic
        >
          {children}
          <CookieConsent />
        </ClerkProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
