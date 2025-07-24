import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/components/auth-provider"
import AuthenticatedLayout from "@/components/authenticated-layout"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "LokaleBanen Dashboard",
  description: "Internal dashboard for LokaleBanen AI agents",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <body className={inter.className}>
        <AuthProvider>
          <AuthenticatedLayout>{children}</AuthenticatedLayout>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
