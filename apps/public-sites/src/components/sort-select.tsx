'use client'

export function SortSelect({ current }: { current: string }) {
  return (
    <select
      defaultValue={current}
      onChange={(e) => {
        const url = new URL(window.location.href)
        url.searchParams.set('sort', e.target.value)
        window.location.href = url.toString()
      }}
      className="text-meta bg-transparent border border-border rounded-lg px-2 py-1"
    >
      <option value="newest">Nieuwste eerst</option>
      <option value="salary_desc">Salaris (hoog &rarr; laag)</option>
      <option value="oldest">Oudste eerst</option>
    </select>
  )
}
