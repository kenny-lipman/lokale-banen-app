"use client"

import { ReactNode, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import Sidebar from "@/components/Sidebar"
import { MainLayout } from "@/components/main-layout"
import { usePathname, useRouter } from "next/navigation"
import { PageLoadingOverlay } from "@/components/ui/loading-states"
import { TooltipProvider } from "@/components/ui/tooltip"

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]

// Special case for invite acceptance
function isPublicRoute(path: string) {
  if (PUBLIC_ROUTES.includes(path)) return true
  if (path.startsWith("/accept-invite/")) return true
  return false
}

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, authState, refresh } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [loadingTimeout, setLoadingTimeout] = useState(false)

  // Add timeout for loading state
  useEffect(() => {
    if (loading || authState === 'INITIALIZING') {
      const timer = setTimeout(() => {
        setLoadingTimeout(true)
      }, 15000) // 15 second timeout

      return () => clearTimeout(timer)
    } else {
      setLoadingTimeout(false)
    }
  }, [loading, authState])

  // Memoize route calculations with improved logic
  const routeInfo = useMemo(() => {
    const isPublic = isPublicRoute(pathname)
    const needsAuth = !isPublic
    const isOnPublicRoute = isPublic
    
    // More conservative redirect logic - only redirect if we're certain about auth state
    const shouldRedirectToLogin = needsAuth && 
      !isAuthenticated && 
      !loading && 
      authState === 'UNAUTHENTICATED'
    
    const shouldRedirectToDashboard = isOnPublicRoute && 
      isAuthenticated && 
      !loading && 
      authState === 'AUTHENTICATED'
    
    return {
      isPublic,
      needsAuth,
      isOnPublicRoute,
      shouldRedirectToLogin,
      shouldRedirectToDashboard
    }
  }, [pathname, isAuthenticated, loading, authState])

  // Handle redirects with improved timing
  useEffect(() => {
    // Don't redirect while still initializing or loading
    if (loading || authState === 'INITIALIZING') {
      console.log('Skipping redirect - still loading or initializing')
      return
    }

    console.log('Route analysis:', {
      pathname,
      authState,
      isAuthenticated,
      loading,
      ...routeInfo
    })
    
    if (routeInfo.shouldRedirectToLogin) {
      console.log('Redirecting to login - user not authenticated')
      router.replace("/login")
    } else if (routeInfo.shouldRedirectToDashboard) {
      console.log('Redirecting to dashboard - user authenticated on public route')
      router.replace("/dashboard")
    }
  }, [routeInfo, router, loading, authState])

  // Show loading overlay during auth initialization with timeout
  if (loading || authState === 'INITIALIZING') {
    return (
      <PageLoadingOverlay 
        message={loadingTimeout ? "Authenticatie duurt langer dan verwacht..." : "Authenticatie controleren..."} 
        showRefreshButton={true}
        onRefresh={refresh}
      />
    )
  }

  // Show error state - but be more permissive
  if (authState === 'ERROR') {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Authenticatie Fout</h2>
          <p className="text-gray-600 mb-4">Er is een probleem opgetreden bij het laden van uw account.</p>
          <div className="space-y-2">
            <button 
              onClick={refresh} 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2"
            >
              Opnieuw Proberen
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Pagina Vernieuwen
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render public routes (login, register, etc.) when not authenticated
  if (!isAuthenticated && routeInfo.isPublic) {
    return <>{children}</>
  }

  // Show loading during redirects
  if (routeInfo.shouldRedirectToLogin) {
    return <PageLoadingOverlay message="Doorverwijzen naar login..." />
  }

  if (routeInfo.shouldRedirectToDashboard) {
    return <PageLoadingOverlay message="Doorverwijzen naar dashboard..." />
  }

  // Render authenticated layout - more permissive check
  if (isAuthenticated && !routeInfo.isPublic) {
    return (
      <TooltipProvider>
        <div className="flex h-screen w-screen overflow-hidden">
          <Sidebar />
          <MainLayout>{children}</MainLayout>
        </div>
      </TooltipProvider>
    )
  }

  // If we're authenticated but on a public route, still show the authenticated layout
  // This prevents the login page from showing when user is already logged in
  if (isAuthenticated && routeInfo.isPublic) {
    return (
      <TooltipProvider>
        <div className="flex h-screen w-screen overflow-hidden">
          <Sidebar />
          <MainLayout>{children}</MainLayout>
        </div>
      </TooltipProvider>
    )
  }

  // Fallback loading state
  return <PageLoadingOverlay message="Laden..." />
} 