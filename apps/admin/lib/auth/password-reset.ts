import { randomBytes, createHash } from 'crypto'

export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000 // 15 minuten

/**
 * Genereer een nieuw plaintext reset-token (64 hex chars, 256 bits entropy).
 * Het plaintext token wordt nooit opgeslagen — alleen de SHA-256 hash.
 */
export function generateResetToken(): string {
  return randomBytes(32).toString('hex')
}

/** SHA-256 hash van een plaintext token, hex-encoded. Deterministic. */
export function hashResetToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

/** Bouw de reset-link die in de email gaat. */
export function buildResetLink(plaintextToken: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://otis-app.vercel.app'
  return `${base.replace(/\/$/, '')}/reset-password?token=${plaintextToken}`
}
