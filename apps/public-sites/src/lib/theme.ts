/**
 * Tenant theme helpers.
 *
 * Generates per-tenant CSS custom properties from a platform row. Handles:
 *   - primary, primary-hover, primary-tint, primary-muted, primary-dark
 *   - secondary, secondary-ink, secondary-tint, secondary-dark
 *   - tertiary
 *   - paper defaults (bg, surface, text, text-muted, border, ...)
 *
 * When secondary/tertiary colors are absent on the tenant we fall back to
 * neutral warm paper tokens so the site still renders cohesively instead of
 * collapsing everything onto primary.
 */

import {
  darkenHex,
  hexToLightVariant,
  hexToMutedVariant,
  getContrastInk,
} from './utils'

export interface ThemeInputs {
  primary?: string | null
  secondary?: string | null
  tertiary?: string | null
}

/** Fallback palette — warm paper aesthetic from the prototype. */
export const PAPER = {
  bg: '#FAF8F4',
  bgTint: '#F5F1E8',
  surface: '#FFFFFF',
  surface2: '#F9F7F1',
  text: '#1A1815',
  text2: '#3E3A34',
  textMuted: '#78716A',
  textFaint: '#A8A29B',
  border: '#E8E3DA',
  borderStrong: '#D4CCBF',
  borderInk: '#1A1815',
  success: '#2D7D46',
  warning: '#B8860B',
  danger: '#A3281D',
  /** When tenant has no secondary we fall back to this warm cream. */
  defaultTertiary: '#F6F1E3',
} as const

/** Editorial typography stack — paired with next/font CSS vars. */
export const FONTS = {
  display: "var(--font-display), 'Iowan Old Style', 'Charter', Georgia, serif",
  body: "var(--font-body), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "var(--font-mono), 'SF Mono', 'Menlo', monospace",
} as const

export interface ResolvedTheme {
  /** Primary — the tenant's signature accent. */
  primary: string
  primaryHover: string
  primaryInk: string
  primaryTint: string
  primaryMuted: string
  primaryDark: string
  /** Secondary — optional tenant accent. Falls back to text (paper ink). */
  secondary: string
  secondaryInk: string
  secondaryTint: string
  secondaryDark: string
  /** Tertiary — optional warm cream shading. */
  tertiary: string
}

/**
 * Resolve a raw set of tenant colors into a full theme token set. Any missing
 * color degrades to a paper-neutral default so we never emit `undefined` CSS.
 */
export function resolveTheme(inputs: ThemeInputs): ResolvedTheme {
  const primary = (inputs.primary && inputs.primary.trim()) || '#0066cc'
  const primaryHover = darkenHex(primary, 0.1)
  const primaryTint = hexToLightVariant(primary, 0.08)
  const primaryMuted = hexToMutedVariant(primary)
  const primaryDark = darkenHex(primary, 0.25)
  const primaryInk = getContrastInk(primary)

  // Secondary: when absent, fall back to the paper ink so sections relying on
  // `--secondary` render as neutral "editorial ink" highlights rather than
  // going invisible.
  const secondaryRaw = inputs.secondary && inputs.secondary.trim()
  const secondary = secondaryRaw || PAPER.text
  const secondaryInk = getContrastInk(secondary)
  const secondaryTint = hexToLightVariant(secondary, 0.08)
  const secondaryDark = darkenHex(secondary, 0.2)

  // Tertiary: defaults to a warm cream when unset.
  const tertiary = (inputs.tertiary && inputs.tertiary.trim()) || PAPER.defaultTertiary

  return {
    primary,
    primaryHover,
    primaryInk,
    primaryTint,
    primaryMuted,
    primaryDark,
    secondary,
    secondaryInk,
    secondaryTint,
    secondaryDark,
    tertiary,
  }
}

/**
 * Build a CSS `:root { ... }` block for a tenant's theme. Ready to inject via
 * `<style dangerouslySetInnerHTML>` in the layout.
 */
export function buildTenantThemeCss(inputs: ThemeInputs): string {
  const t = resolveTheme(inputs)
  return `:root {
  --primary: ${t.primary};
  --primary-hover: ${t.primaryHover};
  --primary-ink: ${t.primaryInk};
  --primary-foreground: ${t.primaryInk};
  --primary-light: ${t.primaryTint};
  --primary-tint: ${t.primaryTint};
  --primary-muted: ${t.primaryMuted};
  --primary-dark: ${t.primaryDark};
  --secondary: ${t.secondary};
  --secondary-ink: ${t.secondaryInk};
  --secondary-foreground: ${t.secondaryInk};
  --secondary-tint: ${t.secondaryTint};
  --secondary-dark: ${t.secondaryDark};
  --tertiary: ${t.tertiary};
}`
}

/** Inline-style variant for use on `<html style={...}>` during prerender. */
export function buildTenantThemeStyle(
  inputs: ThemeInputs
): Record<string, string> {
  const t = resolveTheme(inputs)
  return {
    '--primary': t.primary,
    '--primary-hover': t.primaryHover,
    '--primary-ink': t.primaryInk,
    '--primary-foreground': t.primaryInk,
    '--primary-light': t.primaryTint,
    '--primary-tint': t.primaryTint,
    '--primary-muted': t.primaryMuted,
    '--primary-dark': t.primaryDark,
    '--secondary': t.secondary,
    '--secondary-ink': t.secondaryInk,
    '--secondary-foreground': t.secondaryInk,
    '--secondary-tint': t.secondaryTint,
    '--secondary-dark': t.secondaryDark,
    '--tertiary': t.tertiary,
  }
}
