// In-memory rate-limiting voor het publieke contactformulier (per-instance).
// Bewust process-wide singleton: de Map moet juist gedeeld worden tussen
// requests binnen dezelfde instance. Staat daarom in een eigen module zonder
// 'use server', zodat de mutable module-state niet in een server-action-file leeft.
// Voor multi-instance setups zou Upstash beter zijn. Voor de huidige
// load (lage volume contactformulieren) is in-memory voldoende.

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 3
const submissions = new Map<string, number[]>()

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  const history = (submissions.get(ip) || []).filter((t) => t > cutoff)
  if (history.length >= RATE_LIMIT_MAX) return false
  history.push(now)
  submissions.set(ip, history)
  return true
}
