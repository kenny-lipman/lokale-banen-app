import { toast } from "sonner"

interface RevalidateResult {
  ok: boolean
  skipped?: boolean
  error?: string
}

/**
 * Post-publish/save waarschuwing — operatie slaagde, maar de cache-revalidate
 * ging mis. Niet-fataal, maar de admin moet ervan weten.
 */
export function warnIfPostPublishIssue(
  revalidate: RevalidateResult | null | undefined,
) {
  if (revalidate && !revalidate.ok && !revalidate.skipped) {
    toast.warning("Cache niet ververst — site kan tot 1u stale tonen.")
  }
}
