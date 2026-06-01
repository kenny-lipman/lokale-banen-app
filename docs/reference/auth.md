# Authentication & User Management

> Bij wijziging aan session-flow, role-systeem, users CRUD of password reset: werk deze doc bij in dezelfde commit. Zie ook `conventions.md` voor de auth-seam (`// @auth` markers + wrappers).

## Session management - cookie-based via `@supabase/ssr` + Next middleware
- Browser-client (`apps/admin/lib/supabase.ts`) gebruikt `createBrowserClient` -> schrijft `sb-*` cookies
- `apps/admin/middleware.ts` verfrist cookies op elke request en redirect naar `/login` bij ontbrekende session
- Public paths in middleware: `/login`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/api/auth/reset/*`, `/api/cron/*`, `/api/scrapers/*`
- Plain `fetch()` werkt voor alle same-origin client -> /api/* calls (geen `authFetch` helper meer)

## Role-system - `app_metadata.role` is single source of truth
- Bron: `auth.users.raw_app_meta_data->>'role'` ('admin' of 'member'), alleen via service-role schrijfbaar
- Mirror: `profiles.role` automatisch gesynced via DB-trigger `sync_profile_role`
- Server check: `lib/auth-middleware.ts:resolveRole`
- Client check: `auth-provider.tsx` `isAdmin = user?.app_metadata?.role === 'admin'`
- API routes: `withAuth` (alle ingelogde users) of `withAdminAuth` (admin-only)

## Users CRUD - admin-only (`/admin/gebruikers` UI)
- `GET /api/admin/users` - list
- `POST /api/admin/users` - create (email + password + role, `email_confirm: true`)
- `PATCH /api/admin/users/[id]/role`
- `POST /api/admin/users/[id]/disable` - `ban_duration: '87600h'` + global signOut
- `POST /api/admin/users/[id]/enable`
- `POST /api/admin/users/[id]/force-logout` - `auth.admin.signOut(id, 'global')`
- `DELETE /api/admin/users/[id]` - hard delete
- Anti-lockout: admin kan eigen account niet disablen of deleten

## Custom password reset - eigen 15-min tokens (geen Supabase magic links)
- `POST /api/auth/reset/request` - rate-limited 5/uur per IP + 3/uur per email. **Altijd 200** (geen email enumeration). Stuurt Resend mail vanaf `noreply@cas.works`
- `POST /api/auth/reset/validate` - page-load check (valid|missing|invalid|used|expired)
- `POST /api/auth/reset/confirm` - `updateUserById(password)` + markeer token used + global signOut
- Tokens: SHA-256 hash-only opslag, partial unique index -> max 1 actieve token per user
- Pages: `/forgot-password` (email request) + `/reset-password?token=...` (password set)
- Cleanup-cron `cleanup-reset-tokens` deletet rijen waar `expires_at < now() - 7d`
