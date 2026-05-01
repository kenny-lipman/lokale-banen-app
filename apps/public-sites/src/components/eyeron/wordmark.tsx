import { cn } from '@/lib/utils'

interface WordmarkProps {
  /** Volledige portal-naam, bv. "AchterhoekseBanen" of "Bossche-Banen". */
  name: string
  /** Suffix die in secondary kleur wordt getoond. Default "Banen". */
  suffix?: string
  /** Op een donkere achtergrond? Dan stem in wit ipv primary. */
  onDark?: boolean
  className?: string
}

/**
 * Tweekleurige LokaleBanen-wordmark: stem in primary, suffix in secondary.
 *
 * Splitst op het laatste voorkomen van `suffix`. Voor portals waar de
 * suffix niet past (bv. "Bossche-Banen" met streepje) splitst het op de
 * suffix wanneer aanwezig — anders rendert het de hele naam in primary.
 */
export function Wordmark({
  name,
  suffix = 'Banen',
  onDark,
  className,
}: WordmarkProps) {
  const hasSuffix = name.endsWith(suffix)
  const stem = hasSuffix ? name.slice(0, -suffix.length) : name

  return (
    <span
      className={cn(
        'inline-flex font-bold leading-none tracking-[-0.05em]',
        className
      )}
    >
      <span className={onDark ? 'text-on-dark' : 'text-primary'}>{stem}</span>
      {hasSuffix && <span className="text-secondary">{suffix}</span>}
    </span>
  )
}
