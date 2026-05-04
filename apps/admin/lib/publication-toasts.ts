import { toast } from "sonner"

interface AliasResult {
  ok: boolean
  skipped?: boolean
  alreadyExists?: boolean
  error?: string
}
interface RevalidateResult {
  ok: boolean
  skipped?: boolean
  error?: string
}

/**
 * Post-publish/save waarschuwingen — operatie slaagde, maar een
 * neven-actie (Vercel-alias of cache-revalidate) ging mis. Niet-fataal,
 * maar de admin moet ervan weten.
 */
export function warnIfPostPublishIssue(
  alias: AliasResult | null | undefined,
  revalidate: RevalidateResult | null | undefined,
) {
  if (alias && !alias.ok && !alias.skipped) {
    toast.warning(
      `Vercel-alias kon niet worden bijgewerkt: ${alias.error ?? "onbekende fout"}`,
    )
  }
  if (revalidate && !revalidate.ok && !revalidate.skipped) {
    toast.warning("Cache niet ververst — site kan tot 1u stale tonen.")
  }
}
