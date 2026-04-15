import { MapPin } from 'lucide-react'

interface DistanceChipProps {
  /** Distance in kilometres. When nullish the component renders nothing. */
  km?: number | null
  /** Optional size override — defaults to small (card-meta-row). */
  size?: 'sm' | 'md'
}

/**
 * Distance chip — monospaced pill showing "X.X km" in the tenant's primary
 * tint. Returns `null` when no distance is available so the chip is absent
 * from the DOM (not a placeholder).
 *
 * Usage: `<DistanceChip km={2.3} />` → "⚲ 2.3 km"
 */
export function DistanceChip({ km, size = 'sm' }: DistanceChipProps) {
  if (km == null || Number.isNaN(km)) return null

  const rounded = km >= 10 ? Math.round(km).toString() : km.toFixed(1)
  const iconSize = size === 'md' ? 13 : 11

  return (
    <span
      className="inline-flex items-center gap-[5px] rounded-full font-mono font-medium leading-none"
      style={{
        background: 'var(--primary-tint)',
        color: 'var(--primary-dark)',
        padding: size === 'md' ? '5px 10px 5px 8px' : '4px 9px 4px 7px',
        fontSize: size === 'md' ? '0.8125rem' : '0.75rem',
      }}
    >
      <MapPin
        size={iconSize}
        aria-hidden="true"
        style={{ color: 'var(--primary)' }}
      />
      {rounded} km
    </span>
  )
}
