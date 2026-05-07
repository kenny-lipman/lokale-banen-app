export const ALLOWED_STATUSES = [
  'enriching',
  'review',
  'syncing',
  'completed',
  'failed',
  'duplicate',
] as const

export type RunStatus = (typeof ALLOWED_STATUSES)[number]

export type RunListQuery = {
  status: RunStatus | null
  owner_config_id: string | null
  search: string | null
  date_from: string | null
  date_to: string | null
  page: number
  limit: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parsePositiveInt(value: string | null, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  if (!value) return fallback
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n < min) return fallback
  return Math.min(n, max)
}

export function parseRunListQuery(params: URLSearchParams): RunListQuery {
  const statusRaw = params.get('status')
  const status = (ALLOWED_STATUSES as readonly string[]).includes(statusRaw ?? '')
    ? (statusRaw as RunStatus)
    : null

  const ownerRaw = params.get('owner')
  const owner_config_id = ownerRaw && UUID_RE.test(ownerRaw) ? ownerRaw : null

  const searchRaw = params.get('search')?.trim() ?? ''
  const search = searchRaw.length === 0 ? null : searchRaw.slice(0, 100)

  const dateFromRaw = params.get('date_from')
  const date_from = dateFromRaw && DATE_RE.test(dateFromRaw) ? dateFromRaw : null
  const dateToRaw = params.get('date_to')
  const date_to = dateToRaw && DATE_RE.test(dateToRaw) ? dateToRaw : null

  const page = parsePositiveInt(params.get('page'), 1, 1)
  const limitRaw = params.get('limit')
  const limitN = limitRaw ? Number.parseInt(limitRaw, 10) : 25
  const limit = Number.isFinite(limitN) && limitN >= 1 ? Math.min(limitN, 100) : 25

  return { status, owner_config_id, search, date_from, date_to, page, limit }
}
