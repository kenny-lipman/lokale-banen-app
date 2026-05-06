-- supabase/migrations/20260506000004_automation_runs_unique_running.sql
--
-- Voorkomt twee parallelle 'running' rows voor dezelfde automation_id.
-- Beschermt tegen race tussen scheduled cron en manual trigger.

create unique index automation_runs_one_running_per_id
  on automation_runs (automation_id)
  where status = 'running';
