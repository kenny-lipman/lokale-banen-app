import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { nlNL } from '@clerk/localizations'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { buildTenantThemeCss } from '@/lib/theme'
import { CookieConsent } from '@/components/cookie-consent'
import './globals.css'

/**
 * Default brand-kleuren tijdens static prerender - Achterhoek-groen
 * (de facto LokaleBanen-merkkleur, gebruikt in alle Eyeron brand-docs).
 * Wordt request-time overschreven door <TenantTheme>.
 */
const DEFAULT_PRIMARY = '#0A6333'
const DEFAULT_SECONDARY = '#7BC142'

/**
 * Veilige tenant-resolve: returnt null tijdens static prerender wanneer
 * `headers()` niet beschikbaar is (bv. /_not-found).
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

  const faviconSvg = tenant?.favicon_url ?? null
  // PNG-fallback ligt naast de SVG in dezelfde storage-folder
  const faviconPng = faviconSvg ? faviconSvg.replace(/\.svg(\?.*)?$/, '.png$1') : null

  return {
    title: {
      default: tenant?.hero_title || 'Lokale Banen',
      template: `%s | ${tenant?.name || 'Lokale Banen'}`,
    },
    description: tenant?.seo_description || 'Vind vacatures bij jou in de buurt',
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    icons: faviconSvg
      ? {
          icon: [
            { url: faviconSvg, type: 'image/svg+xml' },
            ...(faviconPng ? [{ url: faviconPng, type: 'image/png' }] : []),
          ],
          shortcut: faviconPng ?? faviconSvg,
          apple: faviconPng ?? faviconSvg,
        }
      : undefined,
  }
}

/**
 * Per-tenant CSS variabelen die request-time worden geinjecteerd. De static
 * shell ship met DEFAULT_PRIMARY/SECONDARY zodat de pagina al bruikbaar is
 * voordat dit component is opgelost.
 */
async function TenantTheme() {
  const tenant = await safeTenant()
  if (!tenant) return null

  const css = buildTenantThemeCss({
    primary: tenant.primary_color || DEFAULT_PRIMARY,
    secondary: tenant.secondary_color || DEFAULT_SECONDARY,
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
  return (
    <html lang="nl">
      <head>
        {/* Preload de twee meest-gebruikte Tomica weights voor LCP-snelheid */}
        <link
          rel="preload"
          href="/fonts/Tomica-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Tomica-Bold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {/* Tenant-specifieke CSS-variabelen streamen in op request-time */}
        <Suspense fallback={null}>
          <TenantTheme />
        </Suspense>
      </head>
      <body>
        <ClerkProvider
          localization={nlNL}
          appearance={{
            variables: {
              colorPrimary: DEFAULT_PRIMARY,
              colorText: '#0A6333',
              colorInputBackground: '#FFFFFF',
              colorInputText: '#0A6333',
              fontFamily: 'Tomica, Inter, system-ui, sans-serif',
              borderRadius: '20px',
            },
            elements: {
              headerSubtitle: { display: 'none' },
            },
          }}
          dynamic
        >
          <>
            {children}
            <CookieConsent />
          </>
        </ClerkProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
