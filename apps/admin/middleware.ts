import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isApiAuthBypassed } from '@/lib/auth-bypass'

// Pages die zonder login bereikbaar moeten blijven.
const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
]

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

  if (!user) {
    // API: fail-closed. Alleen self-verifying routes (cron/webhook/public) mogen
    // zonder sessie door; die checken in-route hun eigen secret/signature. De rest
    // krijgt direct 401 i.p.v. door te vallen naar een mogelijk ongewrapte route.
    if (pathname.startsWith('/api/')) {
      if (isApiAuthBypassed(pathname)) {
        return response
      }
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'NO_SESSION' },
        { status: 401 },
      )
    }

    // Pages zonder login → redirect naar /login.
    if (!PUBLIC_PATHS.includes(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    // Match alles behalve static files en _next internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
  ],
}
