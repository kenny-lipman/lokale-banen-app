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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const tenant = await safeTenant()
  const primaryColor = tenant?.primary_color || '#006B5E'

  // Generate derived colors from primary
  const primaryHover = darkenHex(primaryColor, 0.1)
  const primaryLight = hexToLightVariant(primaryColor, 0.08)
  const primaryMuted = hexToMutedVariant(primaryColor)

  const themeStyle = {
    '--primary': primaryColor,
    '--primary-hover': primaryHover,
    '--primary-light': primaryLight,
    '--primary-muted': primaryMuted,
  } as React.CSSProperties

  return (
    <html lang="nl" className={sourceSans.variable} style={themeStyle}>
      <body className="font-sans">
        <ClerkProvider
          localization={nlNL}
          appearance={{
            variables: {
              colorPrimary: primaryColor,
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
