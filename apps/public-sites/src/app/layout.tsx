import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { nlNL } from '@clerk/localizations'
import { getTenant } from '@/lib/tenant'
import { hexToHsl } from '@/lib/utils'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()

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
  const tenant = await getTenant()
  const primaryHsl = hexToHsl(tenant?.primary_color || '#0066cc')

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
}
