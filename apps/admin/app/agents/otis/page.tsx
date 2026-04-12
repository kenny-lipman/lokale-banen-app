"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function OtisAgentPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the simplified Otis dashboard
    router.replace('/agents/otis/enhanced')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to simplified Otis dashboard...</p>
      </div>
    </div>
  )
} 