// apps/admin/app/automatiseringen/[id]/days-filter.tsx

import Link from 'next/link'

const OPTIONS = [7, 14, 30, 90] as const

export function DaysFilter({
  current,
  pathname,
}: {
  current: number
  pathname: string
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border bg-white p-0.5 text-xs">
      {OPTIONS.map((d) => {
        const active = d === current
        return (
          <Link
            key={d}
            href={`${pathname}?days=${d}`}
            className={`px-2 py-1 rounded ${
              active
                ? 'bg-blue-100 text-blue-800 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {d}d
          </Link>
        )
      })}
    </div>
  )
}
