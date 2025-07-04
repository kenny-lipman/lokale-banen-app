"use client"

import type React from "react"

import { useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { state, toggleSidebar, isMobile } = useSidebar()

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Mobile Header */}
      <header className="h-14 bg-white shadow-md px-6 flex items-center justify-between md:hidden">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={toggleSidebar} className="h-8 w-8 p-0">
            <Menu className="h-4 w-4" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-orange-500 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xs">LB</span>
            </div>
            <span className="font-bold text-lg text-gray-900">LokaleBanen</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
