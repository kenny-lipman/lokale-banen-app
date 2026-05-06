import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Pads die zonder login bereikbaar moeten blijven.
const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
]

const PUBLIC_API_PREFIXES = [
  '/api/auth/reset',   // custom reset-flow endpoints (request, validate, confirm)
  '/api/cron',         // Vercel Cron (eigen CRON_SECRET-auth)
  '/api/scrapers',     // Vercel Cron (eigen CRON_SECRET-auth)
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets / Next internals — niet auth'en
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // BELANGRIJK: getUser() verfrist tokens en synct cookies. Niet vervangen door getSession().
  const { data: { user } } = await supabase.auth.getUser()

  // Niet-public path zonder user → redirect naar /login (alleen voor html pages)
  if (!user && !isPublicPath(pathname)) {
    // API routes geven gewoon door zodat withAuth/withCronAuth zelf 401 kan teruggeven
    if (pathname.startsWith('/api/')) {
      return response
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // Match alles behalve static files en _next internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
  ],
}
