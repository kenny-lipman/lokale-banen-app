export interface BulkTargetRowInput {
  id: string
  plaats: string
  postcode: string | null
  suggested_platform_id: string | null
  suggested_regio_platform: string | null
}

export interface SelectedRowCacheValue {
  id: string
  plaats: string
  postcode: string | null
  suggested_platform_id: string | null
  suggested_regio_platform: string | null
}

// Updater voor de selected-row cache. Returnt `prev` (zelfde referentie) wanneer
// niks verandert, zodat React bij setState bailt en de useEffect-loop niet
// oneindig wordt. Zie React error #185.
export function nextSelectedRowCache(
  prev: Map<string, SelectedRowCacheValue>,
  pagedRows: ReadonlyArray<BulkTargetRowInput>,
  selectedIds: ReadonlySet<string>,
): Map<string, SelectedRowCacheValue> {
  let changed = false
  const next = new Map(prev)

  for (const r of pagedRows) {
    if (!selectedIds.has(r.id)) continue
    const existing = next.get(r.id)
    if (
      existing &&
      existing.plaats === r.plaats &&
      existing.postcode === r.postcode &&
      existing.suggested_platform_id === r.suggested_platform_id &&
      existing.suggested_regio_platform === r.suggested_regio_platform
    ) {
      continue
    }
    next.set(r.id, {
      id: r.id,
      plaats: r.plaats,
      postcode: r.postcode,
      suggested_platform_id: r.suggested_platform_id,
      suggested_regio_platform: r.suggested_regio_platform,
    })
    changed = true
  }

  for (const id of Array.from(next.keys())) {
    if (!selectedIds.has(id)) {
      next.delete(id)
      changed = true
    }
  }

  return changed ? next : prev
}
