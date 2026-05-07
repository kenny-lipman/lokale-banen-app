'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'
import { ALLOWED_STATUSES, type RunStatus } from '@/lib/services/sales-leads/list-filters'

const STATUS_LABELS: Record<RunStatus, string> = {
  enriching: 'Verrijken',
  review: 'Review',
  syncing: 'Syncen',
  completed: 'Voltooid',
  failed: 'Mislukt',
  duplicate: 'Duplicate',
}

type Owner = { id: string; label: string }

export type FilterState = {
  search: string
  status: RunStatus | 'all'
  owner: string | 'all'
  date_from: string
  date_to: string
}

export const EMPTY_FILTERS: FilterState = {
  search: '',
  status: 'all',
  owner: 'all',
  date_from: '',
  date_to: '',
}

type Props = {
  value: FilterState
  onChange: (next: FilterState) => void
  owners: Owner[]
}

export function LeadRunsFilters({ value, onChange, owners }: Props) {
  const set = <K extends keyof FilterState>(key: K, v: FilterState[K]) =>
    onChange({ ...value, [key]: v })

  const isEmpty =
    value.search === '' &&
    value.status === 'all' &&
    value.owner === 'all' &&
    value.date_from === '' &&
    value.date_to === ''

  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <div className="flex-1 min-w-[220px]">
        <label className="block text-xs text-gray-600 mb-1">Zoek (domein)</label>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-8"
            placeholder="bijv. wetarget.nl"
            value={value.search}
            onChange={(e) => set('search', e.target.value)}
          />
        </div>
      </div>

      <div className="min-w-[140px]">
        <label className="block text-xs text-gray-600 mb-1">Status</label>
        <Select value={value.status} onValueChange={(v) => set('status', v as FilterState['status'])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            {ALLOWED_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-[180px]">
        <label className="block text-xs text-gray-600 mb-1">Dealeigenaar</label>
        <Select value={value.owner} onValueChange={(v) => set('owner', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle eigenaars</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">Vanaf</label>
        <Input
          type="date"
          value={value.date_from}
          onChange={(e) => set('date_from', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">Tot</label>
        <Input
          type="date"
          value={value.date_to}
          onChange={(e) => set('date_to', e.target.value)}
        />
      </div>

      {!isEmpty && (
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
          <X className="w-3 h-3 mr-1" />
          Wis filters
        </Button>
      )}
    </div>
  )
}
