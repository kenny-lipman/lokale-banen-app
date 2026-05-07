import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "sonner"
import { AuthProvider } from "@/components/auth-provider"
import AuthenticatedLayout from "@/components/authenticated-layout"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { SWRProvider } from "@/lib/swr-config"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "LokaleBanen Dashboard",
  description: "Internal dashboard for LokaleBanen AI agents",
  generator: 'v0.dev',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.svg', type: 'image/svg+xml' }
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.ico'
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <body className={inter.className}>
        <ErrorBoundary>
          <SWRProvider>
            <AuthProvider>
              <AuthenticatedLayout>{children}</AuthenticatedLayout>
              <Toaster />
            </AuthProvider>
          </SWRProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
