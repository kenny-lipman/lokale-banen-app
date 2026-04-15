import { redirect } from "next/navigation"

/**
 * /review is consolidated into /job-postings?status=pending.
 * This redirect preserves old bookmarks and nav links.
 * The previous custom review UI (bulk approve/reject, platform dropdown) is now
 * available on /job-postings via status tabs + BulkActionBar, alongside the
 * existing power-user filters and drawer.
 */
export default function ReviewPage() {
  redirect("/job-postings?status=pending")
}
