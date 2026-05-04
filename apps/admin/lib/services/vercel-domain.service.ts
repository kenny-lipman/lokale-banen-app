/**
 * Adds a domain (alias) to the public-sites Vercel project so newly-published
 * platforms become reachable on their `<slug>.vercel.app` host without manual
 * intervention.
 *
 * Idempotent: if the domain is already attached to this project, treats it as
 * success. Only fails when the domain is owned by a different project or when
 * the API call itself errors.
 */

const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN
const PUBLIC_SITES_PROJECT_ID = process.env.VERCEL_PUBLIC_SITES_PROJECT_ID
const TEAM_ID = process.env.VERCEL_TEAM_ID

export interface EnsureAliasResult {
  ok: boolean
  skipped?: boolean
  alreadyExists?: boolean
  status?: number
  reason?: string
  error?: string
}

export async function ensureVercelAlias(
  host: string,
): Promise<EnsureAliasResult> {
  if (!VERCEL_TOKEN || !PUBLIC_SITES_PROJECT_ID) {
    return {
      ok: false,
      skipped: true,
      reason: "config-missing",
    }
  }

  const teamQuery = TEAM_ID ? `?teamId=${encodeURIComponent(TEAM_ID)}` : ""
  const url = `https://api.vercel.com/v10/projects/${encodeURIComponent(
    PUBLIC_SITES_PROJECT_ID,
  )}/domains${teamQuery}`

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: host }),
    })
  } catch (err) {
    return { ok: false, error: String(err) }
  }

  if (res.ok) {
    return { ok: true, status: res.status }
  }

  if (res.status === 409) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string }
    }
    const code = body?.error?.code

    // Domain owned by a different project — admin must intervene.
    if (code === "domain_already_in_use_by_different_project") {
      return {
        ok: false,
        status: 409,
        error: body.error?.message ?? "domain_already_in_use_by_different_project",
      }
    }

    // Already attached to this project (or unknown 409): treat as success.
    return { ok: true, status: 409, alreadyExists: true }
  }

  const text = await res.text().catch(() => "")
  return { ok: false, status: res.status, error: text }
}
