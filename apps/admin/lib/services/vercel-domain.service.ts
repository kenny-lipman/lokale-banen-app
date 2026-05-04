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

// RFC 1035 / 1123 hostname (incl. punten): alleen letters, cijfers,
// koppeltekens en punten; max 253 chars; geen leading/trailing dot.
const HOST_REGEX = /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/

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

  // M5: input-validatie — voorkomt dat whitespace/garbage een raw 400-blob
  // van Vercel oplevert die we nergens zinvol mee kunnen renderen.
  const trimmed = typeof host === "string" ? host.trim() : ""
  if (!trimmed || !HOST_REGEX.test(trimmed)) {
    return {
      ok: false,
      reason: "invalid-host",
      error: `Ongeldige hostname: "${host}"`,
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
      body: JSON.stringify({ name: trimmed }),
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

    // Alleen "owned by this project" telt als idempotente success.
    if (code === "domain_already_in_use_by_this_project") {
      return { ok: true, status: 409, alreadyExists: true }
    }

    // M4: log de raw Vercel-foutmelding server-side (kan project-IDs of
    // teamnamen bevatten) maar geef de admin-UI alleen een generieke
    // boodschap met de error-code.
    console.warn(
      `[ensureVercelAlias] 409 from Vercel for host=${trimmed}:`,
      body?.error?.message ?? body,
    )
    return {
      ok: false,
      status: 409,
      error:
        code === "domain_already_in_use_by_different_project"
          ? "Dit domein is al gekoppeld aan een ander Vercel-project."
          : `Vercel weigerde domain (${code ?? "onbekende reden"}).`,
    }
  }

  const rawText = await res.text().catch(() => "")
  console.warn(
    `[ensureVercelAlias] ${res.status} from Vercel for host=${trimmed}:`,
    rawText.slice(0, 500),
  )
  return {
    ok: false,
    status: res.status,
    error: `Vercel API gaf ${res.status}; zie server-log.`,
  }
}
