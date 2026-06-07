-- Soft-archive voor OTIS lead-runs: verberg een run uit de lijsten zonder de
-- pipeline-status (completed/duplicate/...) te verliezen, en omkeerbaar (NULL = actief).
ALTER TABLE public.sales_lead_runs
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN public.sales_lead_runs.archived_at IS
  'Soft-archive marker. NULL = actief. Gezet via DELETE /api/sales-leads/[id]; verbergt de run uit de OTIS-lijsten zonder de pipeline-status te verliezen.';

-- Partiele index voor de actieve-lijst-query (archived_at IS NULL, gesorteerd op created_at).
CREATE INDEX IF NOT EXISTS sales_lead_runs_active_created_idx
  ON public.sales_lead_runs (created_at DESC)
  WHERE archived_at IS NULL;
