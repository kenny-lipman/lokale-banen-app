-- supabase/migrations/20260506000003_get_automation_run_stats_rpc.sql

create or replace function get_automation_run_stats(
  since_date timestamptz,
  filter_automation_id text default ''
)
returns table (
  automation_id text,
  total_runs bigint,
  success_count bigint,
  error_count bigint,
  timeout_count bigint,
  avg_duration_ms numeric,
  max_duration_ms integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    automation_id,
    count(*) as total_runs,
    count(*) filter (where status = 'success') as success_count,
    count(*) filter (where status = 'error') as error_count,
    count(*) filter (where status = 'timeout') as timeout_count,
    coalesce(avg(duration_ms), 0) as avg_duration_ms,
    coalesce(max(duration_ms), 0) as max_duration_ms
  from automation_runs
  where started_at >= since_date
    and (filter_automation_id = '' or automation_id = filter_automation_id)
  group by automation_id;
$$;

grant execute on function get_automation_run_stats(timestamptz, text) to authenticated;
