'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import type { NormalizedVacancy, RunEnrichments } from '@/lib/services/sales-leads/types'

type Props = {
  manualVacancies: NormalizedVacancy[]
  enrichments: RunEnrichments
  selectedTitles: string[]
  onChange: (selectedTitles: string[]) => void
}

export function LeadVacanciesColumn({ manualVacancies, enrichments, selectedTitles, onChange }: Props) {
  const websiteVacancies = enrichments.website?.parsed?.vacancies ?? []
  const all: NormalizedVacancy[] = [...manualVacancies, ...websiteVacancies]
  const seen = new Set<string>()
  const unique = all.filter((v) => {
    const k = v.title.trim().toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  const selectedSet = new Set(selectedTitles.map((t) => t.toLowerCase()))

  function toggle(title: string) {
    const k = title.trim().toLowerCase()
    if (selectedSet.has(k)) {
      onChange(selectedTitles.filter((t) => t.toLowerCase() !== k))
    } else {
      onChange([...selectedTitles, title])
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vacatures</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {unique.length === 0 && (
          <p className="text-xs text-gray-500">Geen vacatures gevonden.</p>
        )}
        {unique.map((v, idx) => {
          const checked = selectedSet.has(v.title.trim().toLowerCase())
          return (
            <label key={v.title || `vac-${idx}`} className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={checked} onCheckedChange={() => toggle(v.title)} />
              <div className="flex-1">
                <p className="text-sm">
                  {v.title}
                  <span className="ml-2 text-[10px] text-gray-400 uppercase">{v.source}</span>
                </p>
                {v.location && <p className="text-xs text-gray-500">{v.location}</p>}
                {v.detail && (() => {
                  const d = v.detail
                  const hours =
                    d.working_hours_min != null
                      ? `${d.working_hours_min}${d.working_hours_max != null && d.working_hours_max !== d.working_hours_min ? `-${d.working_hours_max}` : ''} u/wk`
                      : null
                  const chips = [d.salary, d.employment, hours, d.education_level, d.career_level].filter(
                    (c): c is string => !!c,
                  )
                  return chips.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {chips.map((c, i) => (
                        <span key={i} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : null
                })()}
                {v.url && (
                  <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-600 underline">
                    bekijk
                  </a>
                )}
              </div>
            </label>
          )
        })}
      </CardContent>
    </Card>
  )
}
