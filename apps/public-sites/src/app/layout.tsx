import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { hexToHsl } from '@/lib/utils'
import './globals.css'

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
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
  const primaryHsl = hexToHsl(tenant?.primary_color || '#0066cc')

  const body = (
    <html lang="nl" className={inter.variable}>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `:root { --primary: ${primaryHsl}; --ring: ${primaryHsl}; }`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  )

  // Wrap with ClerkProvider only if Clerk is configured
  if (CLERK_ENABLED) {
    try {
      const { ClerkProvider } = await import('@clerk/nextjs')
      const { nlNL } = await import('@clerk/localizations')
      return (
        <html lang="nl" className={inter.variable}>
          <head>
            <style
              dangerouslySetInnerHTML={{
                __html: `:root { --primary: ${primaryHsl}; --ring: ${primaryHsl}; }`,
              }}
            />
          </head>
          <body className="min-h-screen flex flex-col">
            <ClerkProvider
              localization={nlNL}
              appearance={{
                variables: {
                  colorPrimary: tenant?.primary_color || '#0066cc',
                  colorText: 'hsl(222 47% 11%)',
                  colorInputBackground: 'hsl(0 0% 100%)',
                  colorInputText: 'hsl(222 47% 11%)',
                  fontFamily: 'var(--font-inter)',
                  borderRadius: '8px',
                },
              }}
              dynamic
            >
              {children}
            </ClerkProvider>
          </body>
        </html>
      )
    } catch {
      // Clerk import failed, use plain layout
    }
  }

  return body
}
