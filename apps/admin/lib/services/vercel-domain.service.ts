/**
 * Wijst een hostname (alias) toe aan de huidige production-deployment van het
 * public-sites Vercel-project zodat een zojuist-gepublishte platform direct
 * via zijn `<slug>.vercel.app` host bereikbaar is.
 *
 * Implementatie via `POST /v2/deployments/{deploymentId}/aliases` — niet via
 * `POST /v9/projects/{id}/domains`. Reden: alle bestaande preview_domains zijn
 * historisch als deployment-aliases gepind. Een project-domain-add zou een
 * 409 geven en de oude pin niet automatisch verschuiven, met als gevolg dat
 * nieuwe code-deploys niet op de regio-URL's tot uiting komen.
 *
 * Vercel re-bindt een bestaande alias automatisch naar de nieuwe deployment
 * (response bevat `oldDeploymentId`), dus deze flow is idempotent: bij een
 * tweede aanroep met dezelfde host op dezelfde latest-prod is er simpelweg
 * geen wijziging.
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
  /** Welke deployment de alias daarvoor wees naar (handig voor logging). */
  rebound_from?: string
  /** Naar welke deployment de alias nu wijst. */
  deployment?: string
}

// RFC 1035 / 1123 hostname (incl. punten): alleen letters, cijfers,
// koppeltekens en punten; max 253 chars; geen leading/trailing dot.
const HOST_REGEX = /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/

const teamQueryString = (sep: "?" | "&") =>
  TEAM_ID ? `${sep}teamId=${encodeURIComponent(TEAM_ID)}` : ""

/** Haalt de meest recente READY production-deployment van public-sites op. */
async function getLatestProdDeploymentId(): Promise<string | null> {
  if (!VERCEL_TOKEN || !PUBLIC_SITES_PROJECT_ID) return null
  const url = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(
    PUBLIC_SITES_PROJECT_ID,
  )}&target=production&state=READY&limit=1${teamQueryString("&")}`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { deployments?: { uid: string }[] }
    return json.deployments?.[0]?.uid ?? null
  } catch {
    return null
  }
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

  // Input-validatie — voorkomt raw 400-bodies van Vercel.
  const trimmed = typeof host === "string" ? host.trim() : ""
  if (!trimmed || !HOST_REGEX.test(trimmed)) {
    return {
      ok: false,
      reason: "invalid-host",
      error: `Ongeldige hostname: "${host}"`,
    }
  }

  const deploymentId = await getLatestProdDeploymentId()
  if (!deploymentId) {
    return {
      ok: false,
      reason: "no-prod-deployment",
      error:
        "Kon geen READY production-deployment vinden voor public-sites project.",
    }
  }

  const url = `https://api.vercel.com/v2/deployments/${encodeURIComponent(
    deploymentId,
  )}/aliases${teamQueryString("?")}`

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ alias: trimmed }),
    })
  } catch (err) {
    return { ok: false, error: String(err) }
  }

  if (res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      oldDeploymentId?: string
    }
    return {
      ok: true,
      status: res.status,
      deployment: deploymentId,
      rebound_from: body.oldDeploymentId,
      alreadyExists: !!body.oldDeploymentId,
    }
  }

  // 409 = alias geclaimd door een ander project / kan niet worden verplaatst.
  if (res.status === 409) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string }
    }
    console.warn(
      `[ensureVercelAlias] 409 from Vercel for host=${trimmed}:`,
      body?.error?.message ?? body,
    )
    const code = body?.error?.code
    return {
      ok: false,
      status: 409,
      error:
        code === "alias_in_use" || code === "forbidden"
          ? "Dit domein is al gekoppeld aan een ander Vercel-project of team."
          : `Vercel weigerde alias (${code ?? "onbekende reden"}).`,
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
