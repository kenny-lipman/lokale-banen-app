import { cn } from '@/lib/utils'
import { Wordmark } from './wordmark'

interface PortalLogoProps {
  /** DB regio_platform — komt 1-op-1 overeen met de SVG-bestandsnaam. */
  tenantName: string
  /**
   * Custom uploaded logo (platforms.logo_url). Wordt verkozen boven de
   * pre-processed SVG zodat per-platform branding via admin werkt.
   */
  logoUrl?: string | null
  className?: string
  /** Render-hoogte in px (default 43, per Eyeron-spec). */
  height?: number
  /** Override alt-tekst. Default: `${tenantName} logo`. */
  alt?: string
  /**
   * Forceer wordmark-render (bv. in footer waar alleen de tekst getoond
   * wordt). Skipt het laden van de SVG.
   */
  asWordmark?: boolean
}

/**
 * Per-portal logo. Voorkeur volgorde:
 *   1. `logoUrl` (admin-geuploade afbeelding uit `platforms.logo_url`)
 *   2. pre-processed SVG `/logos/${tenantName}.svg` met `var(--primary)` /
 *      `var(--secondary)` fills (zie `scripts/preprocess-logos.mjs`)
 *
 * Bij ontbreken van beide rendert browser de alt-tekst.
 */
export function PortalLogo({
  tenantName,
  logoUrl,
  className,
  height = 43,
  alt,
  asWordmark = false,
}: PortalLogoProps) {
  if (asWordmark) {
    return <Wordmark name={tenantName} className={className} />
  }

  const src = logoUrl || `/logos/${encodeURIComponent(tenantName)}.svg`

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt ?? `${tenantName} logo`}
      style={{ height }}
      className={cn('w-auto block', className)}
    />
  )
}

interface MasterLogoProps {
  className?: string
  height?: number
  alt?: string
}

/**
 * LokaleBanen master-logo (lokalebanen.nl). Eigen kleuren — geen tenant-
 * theming. Gebruikt het pre-processed `_master.svg` asset.
 */
export function MasterLogo({
  className,
  height = 33,
  alt = 'LokaleBanen',
}: MasterLogoProps) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/logos/_master.svg"
      alt={alt}
      style={{ height }}
      className={cn('w-auto block', className)}
    />
  )
}
