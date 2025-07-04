import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { MainLayout } from "@/components/main-layout"

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
        <SidebarProvider defaultOpen={true}>
          <div className="flex h-screen w-screen overflow-hidden">
            <AppSidebar />
            <MainLayout>{children}</MainLayout>
          </div>
          <Toaster />
        </SidebarProvider>
      </body>
    </html>
  )
}
