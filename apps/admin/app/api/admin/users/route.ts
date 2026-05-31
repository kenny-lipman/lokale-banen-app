// @auth ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

type UserRole = 'admin' | 'member'

function isValidRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'member'
}

async function listHandler(_req: NextRequest, _auth: AuthResult) {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profiles } = await supabase.from('profiles').select('id, full_name')
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

  const users = data.users.map((u) => {
    const role = (u.app_metadata as Record<string, unknown> | undefined)?.role
    const banned = u.banned_until ? new Date(u.banned_until) > new Date() : false
    return {
      id: u.id,
      email: u.email ?? '',
      full_name: profileById.get(u.id)?.full_name ?? null,
      role: isValidRole(role) ? role : 'member',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      banned,
    }
  })
  users.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))

  return NextResponse.json({ users })
}

async function createHandler(req: NextRequest, _auth: AuthResult) {
  const body = await req.json().catch(() => ({}))
  const { email, password, full_name, role } = body as {
    email?: string
    password?: string
    full_name?: string | null
    role?: string
  }

  if (!email || typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Geldig e-mailadres vereist' }, { status: 400 })
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Wachtwoord moet minimaal 8 tekens bevatten' }, { status: 400 })
  }
  if (!isValidRole(role)) {
    return NextResponse.json({ error: 'Rol moet "admin" of "member" zijn' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: full_name ? { full_name } : undefined,
  })
  if (error) {
    const status = error.message.toLowerCase().includes('already registered') ? 409 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json({ user: { id: data.user.id, email: data.user.email, role } }, { status: 201 })
}

export const GET = withAdminAuth(listHandler)
export const POST = withAdminAuth(createHandler)
