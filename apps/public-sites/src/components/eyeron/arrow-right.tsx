import { cn } from '@/lib/utils'

interface ArrowRightProps {
  className?: string
  width?: number | string
  height?: number | string
}

/**
 * Custom gevulde pijl per Eyeron-spec - NIET de Lucide-versie (die is
 * stroke-based). Gebruikt `currentColor` zodat hij erft van parent text-color.
 *
 * Default 13×13px, schaalt mee als width/height worden meegegeven.
 */
export function ArrowRight({ className, width = 13, height = 13 }: ArrowRightProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <path d="M15.7071 5.29289C15.3166 4.90237 14.6834 4.90237 14.2929 5.29289C13.9024 5.68342 13.9024 6.31658 14.2929 6.70711L18.5858 11L3 11C2.44772 11 2 11.4477 2 12C2 12.5523 2.44772 13 3 13L18.5858 13L14.2929 17.2929C13.9024 17.6834 13.9024 18.3166 14.2929 18.7071C14.6834 19.0976 15.3166 19.0976 15.7071 18.7071L21.7071 12.7071C22.0976 12.3166 22.0976 11.6834 21.7071 11.2929L15.7071 5.29289Z" />
    </svg>
  )
}
