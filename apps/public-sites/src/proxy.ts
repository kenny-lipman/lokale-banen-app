import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Proxy (middleware) that injects x-tenant-host header for tenant resolution.
 * Clerk auth is conditionally enabled via env var.
 */

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export default async function proxy(req: NextRequest) {
  const host = req.headers.get('host') || req.headers.get('x-forwarded-host') || ''
  const hostname = host.split(':')[0]

  // If Clerk is enabled, dynamically import and use clerkMiddleware
  if (CLERK_ENABLED) {
    try {
      const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server')
      const isProtectedRoute = createRouteMatcher(['/account(.*)'])

      return clerkMiddleware(async (auth, clerkReq: NextRequest) => {
        if (isProtectedRoute(clerkReq)) {
          await auth.protect()
        }

        const requestHeaders = new Headers(clerkReq.headers)
        requestHeaders.set('x-tenant-host', hostname)

        return NextResponse.next({
          request: { headers: requestHeaders },
        })
      })(req, {} as never)
    } catch {
      // Clerk import failed, fall through to simple proxy
    }
  }

  // Simple proxy: just inject tenant host header
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-tenant-host', hostname)

  // Redirect /account/* to homepage when Clerk is not available
  if (req.nextUrl.pathname.startsWith('/account')) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
