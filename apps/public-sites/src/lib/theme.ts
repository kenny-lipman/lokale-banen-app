/**
 * Per-tenant theme generation.
 *
 * Produceert een `<style>`-block met de twee brand-kleuren en alle afgeleide
 * states (hover/active/tint/ink). Statische neutralen leven in `globals.css`
 * en worden hier niet aangeraakt.
 *
 * De DB heeft historisch een `tertiary_color` kolom - die wordt door het
 * Eyeron-design niet gebruikt en hier ook niet gerendered. Kolom blijft
 * bestaan voor data-compatibiliteit met de admin-app.
 */

import { darkenHex, hexToLightVariant, getContrastInk } from './utils'

export interface ThemeInputs {
  primary?: string | null
  secondary?: string | null
}

/** Default brand-kleuren (Achterhoek-groen) - fallback als DB geen waarden heeft. */
const DEFAULT_PRIMARY = '#0A6333'
const DEFAULT_SECONDARY = '#7BC142'

export interface ResolvedTheme {
  primary:        string
  primaryHover:   string
  primaryActive:  string
  primaryTint08:  string
  primaryTint16:  string
  primaryInk:     string
  secondary:      string
  secondaryHover: string
  secondaryActive:string
  secondaryInk:   string
}

/**
 * Resolve raw tenant kleur-input naar volledige token-set met afgeleide
 * hover/active/tint variabelen. Lege strings vallen terug op de defaults.
 */
export function resolveTheme(inputs: ThemeInputs): ResolvedTheme {
  const primary = (inputs.primary && inputs.primary.trim()) || DEFAULT_PRIMARY
  const secondary = (inputs.secondary && inputs.secondary.trim()) || DEFAULT_SECONDARY

  return {
    primary,
    primaryHover:   darkenHex(primary, 0.12),
    primaryActive:  darkenHex(primary, 0.24),
    primaryTint08:  hexToLightVariant(primary, 0.08),
    primaryTint16:  hexToLightVariant(primary, 0.16),
    primaryInk:     getContrastInk(primary),
    secondary,
    secondaryHover: darkenHex(secondary, 0.12),
    secondaryActive:darkenHex(secondary, 0.24),
    secondaryInk:   getContrastInk(secondary),
  }
}

/**
 * Build een `:root { ... }` CSS-blok voor een tenant - bedoeld om via
 * `<style dangerouslySetInnerHTML>` in `<head>` te injecteren.
 */
export function buildTenantThemeCss(inputs: ThemeInputs): string {
  const t = resolveTheme(inputs)
  return `:root {
  --primary: ${t.primary};
  --primary-hover: ${t.primaryHover};
  --primary-active: ${t.primaryActive};
  --primary-tint-08: ${t.primaryTint08};
  --primary-tint-16: ${t.primaryTint16};
  --primary-ink: ${t.primaryInk};
  --secondary: ${t.secondary};
  --secondary-hover: ${t.secondaryHover};
  --secondary-active: ${t.secondaryActive};
  --secondary-ink: ${t.secondaryInk};
}`
}

/**
 * Inline-style variant voor op `<html style={...}>` tijdens static prerender.
 */
export function buildTenantThemeStyle(
  inputs: ThemeInputs
): Record<string, string> {
  const t = resolveTheme(inputs)
  return {
    '--primary':           t.primary,
    '--primary-hover':     t.primaryHover,
    '--primary-active':    t.primaryActive,
    '--primary-tint-08':   t.primaryTint08,
    '--primary-tint-16':   t.primaryTint16,
    '--primary-ink':       t.primaryInk,
    '--secondary':         t.secondary,
    '--secondary-hover':   t.secondaryHover,
    '--secondary-active':  t.secondaryActive,
    '--secondary-ink':     t.secondaryInk,
  }
}
