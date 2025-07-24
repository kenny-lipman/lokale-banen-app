// Simple in-memory rate limiter (not for production!)
const store: Record<string, { count: number; reset: number }> = {}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  if (!store[key] || store[key].reset < now) {
    store[key] = { count: 1, reset: now + windowMs }
    return { allowed: true, remaining: limit - 1, reset: store[key].reset }
  }
  if (store[key].count < limit) {
    store[key].count++
    return { allowed: true, remaining: limit - store[key].count, reset: store[key].reset }
  }
  return { allowed: false, remaining: 0, reset: store[key].reset }
} 