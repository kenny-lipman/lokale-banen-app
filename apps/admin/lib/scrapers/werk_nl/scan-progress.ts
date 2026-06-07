import { PAGE_SIZE } from "./constants";

/**
 * Fail-closed full-pass completion check.
 * A non-empty page may complete the pass when it covers totalResults.
 * An empty page only completes if earlier pages already covered totalResults.
 */
export function shouldCompleteFullPass(page: number, itemCount: number, total: number): boolean {
  if (total <= 0) return false;
  if (itemCount > 0) return page * PAGE_SIZE >= total;
  return (page - 1) * PAGE_SIZE >= total;
}

export function hasTimeBudget(startMs: number, nowMs: number, budgetMs: number): boolean {
  return nowMs - startMs < budgetMs;
}
