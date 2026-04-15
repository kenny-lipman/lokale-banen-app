import { NextRequest, NextResponse } from "next/server"

import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

interface ProfileResponse {
  display_name: string
  email: string | null
}

/**
 * Lightweight lookup endpoint used by ActivityLog and other components to
 * display a human-readable name/email for an opaque user id (UUID from
 * auth.users, or text user_id stored on user_profiles).
 *
 * Strategy:
 *  1. Look up `public.user_profiles` by `user_id`. That table can hold a
 *     display_name + email set by the app itself. Currently empty, but the
 *     component contract survives future backfills.
 *  2. Fall back to `auth.users` via the service-role admin API. Most
 *     reviewed_by ids on job_postings will live here.
 *
 * Returns 404 only when both lookups fail.
 */
async function getHandler(
  _req: NextRequest,
  _auth: AuthResult,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Ongeldig gebruikers-id" },
        { status: 400 },
      )
    }

    const supabase = createServiceRoleClient()

    // 1. user_profiles first. We cast to any because the generated Database
    //    types may not match the actual columns (display_name/email).
    const { data: profileRow } = await (supabase as any)
      .from("user_profiles")
      .select("user_id, display_name, email")
      .eq("user_id", id)
      .maybeSingle()

    if (profileRow) {
      const profile = profileRow as {
        user_id: string
        display_name: string | null
        email: string | null
      }
      const payload: ProfileResponse = {
        display_name: deriveDisplayName(profile.display_name, profile.email, id),
        email: profile.email ?? null,
      }
      return NextResponse.json({ success: true, data: payload })
    }

    // 2. Fall back to auth.users via admin API. The admin client exists as
    //    a nested property on the service-role client.
    const adminClient = (supabase as unknown as {
      auth?: { admin?: { getUserById?: (id: string) => Promise<{ data?: { user?: unknown }; error?: unknown }> } }
    }).auth?.admin

    if (adminClient?.getUserById) {
      const { data: adminData, error: adminErr } = await adminClient.getUserById(id)
      if (!adminErr && adminData?.user) {
        const authUser = adminData.user as {
          id: string
          email?: string | null
          user_metadata?: Record<string, unknown> | null
        }
        const meta = authUser.user_metadata ?? {}
        const metaName =
          (typeof meta["full_name"] === "string" ? (meta["full_name"] as string) : null) ??
          (typeof meta["name"] === "string" ? (meta["name"] as string) : null) ??
          null

        const payload: ProfileResponse = {
          display_name: deriveDisplayName(metaName, authUser.email ?? null, id),
          email: authUser.email ?? null,
        }
        return NextResponse.json({ success: true, data: payload })
      }
    }

    return NextResponse.json(
      { success: false, error: "Gebruiker niet gevonden" },
      { status: 404 },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}

/**
 * Choose the best display label we can produce from the available fields.
 * Order: explicit name -> email local-part -> truncated id -> "?".
 */
function deriveDisplayName(
  name: string | null | undefined,
  email: string | null | undefined,
  fallbackId: string,
): string {
  const trimmedName = name?.trim()
  if (trimmedName) return trimmedName

  if (email) {
    const local = email.split("@")[0]
    if (local && local.trim().length > 0) return local
  }

  if (fallbackId && fallbackId.length > 0) {
    return fallbackId.slice(0, 8)
  }

  return "?"
}

export const GET = withAuth(getHandler)
