"use client"

import type React from "react"
import { UserInfo } from "@/components/user-info"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header met user info rechtsboven */}
      <header className="h-14 bg-white shadow-md px-6 flex items-center justify-end">
        <UserInfo />
      </header>
      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
