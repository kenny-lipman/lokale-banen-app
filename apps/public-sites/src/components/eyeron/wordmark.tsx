import { cn } from '@/lib/utils'

interface WordmarkProps {
  /** Volledige portal-naam, bv. "AchterhoekseBanen" of "Bossche-Banen". */
  name: string
  /** Suffix die apart gestyled wordt. Default "Banen". */
  suffix?: string
  /** Op een donkere achtergrond? Dan stem in wit ipv primary. */
  onDark?: boolean
  /**
   * Mono-variant: stem en suffix krijgen dezelfde kleur, suffix in `font-light`
   * ipv accent-kleur. Voor footer en andere plekken waar het wordmark in één
   * kleur op een gekleurde achtergrond staat.
   */
  mono?: boolean
  className?: string
}

/**
 * LokaleBanen-wordmark. Default: stem in primary kleur + suffix in secondary
 * accent-kleur (beide bold). Mono-variant: zelfde kleur, suffix in light weight.
 *
 * Splitst op het laatste voorkomen van `suffix`. Voor portals waar de
 * suffix niet past (bv. "Bossche-Banen" met streepje) rendert het de hele
 * naam in stem-styling.
 */
export function Wordmark({
  name,
  suffix = 'Banen',
  onDark,
  mono,
  className,
}: WordmarkProps) {
  const hasSuffix = name.endsWith(suffix)
  const stem = hasSuffix ? name.slice(0, -suffix.length) : name
  const stemColor = onDark ? 'text-on-dark' : 'text-primary'

  return (
    <span
      className={cn(
        'inline-flex font-bold leading-none tracking-[-0.05em]',
        className
      )}
    >
      <span className={stemColor}>{stem}</span>
      {hasSuffix && (
        <span className={mono ? cn(stemColor, 'font-light') : 'text-secondary'}>
          {suffix}
        </span>
      )}
    </span>
  )
}
