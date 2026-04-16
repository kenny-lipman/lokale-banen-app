import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'

const isProtectedRoute = createRouteMatcher(['/account(.*)'])

export default clerkMiddleware(async (auth, req: NextRequest) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  // Tenant host injection (essential for multi-tenant resolution)
  const host = req.headers.get('host') || req.headers.get('x-forwarded-host') || ''
  const hostname = host.split(':')[0]

  Sentry.setTag('tenant', hostname || 'unknown')

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-tenant-host', hostname)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
