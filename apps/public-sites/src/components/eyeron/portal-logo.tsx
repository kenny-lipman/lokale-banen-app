import { cn } from '@/lib/utils'
import { Wordmark } from './wordmark'

interface PortalLogoProps {
  /** DB regio_platform — komt 1-op-1 overeen met de SVG-bestandsnaam. */
  tenantName: string
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
 * Per-portal logo, gerenderd vanuit een pre-processed SVG met
 * `var(--primary)` / `var(--secondary)` fills (zie
 * `scripts/preprocess-logos.mjs`).
 *
 * Bestandsnaam = exact `tenantName` (= DB `regio_platform`-string).
 * Als de SVG niet bestaat valt het terug op `<Wordmark>` via de browser
 * `onerror` (alt-tekst) — voor portals zonder gegenereerde SVG.
 */
export function PortalLogo({
  tenantName,
  className,
  height = 43,
  alt,
  asWordmark = false,
}: PortalLogoProps) {
  if (asWordmark) {
    return <Wordmark name={tenantName} className={className} />
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`/logos/${encodeURIComponent(tenantName)}.svg`}
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
