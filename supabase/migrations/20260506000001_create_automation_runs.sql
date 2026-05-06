-- supabase/migrations/20260506000001_create_automation_runs.sql

create table automation_runs (
  id                  uuid primary key default gen_random_uuid(),
  automation_id       text not null,
  started_at          timestamptz not null,
  completed_at        timestamptz,
  duration_ms         integer,
  status              text not null check (status in ('running','success','error','timeout')),
  http_status         integer,
  error_message       text,
  business_stats      jsonb,
  triggered_by        text not null default 'schedule' check (triggered_by in ('schedule','manual')),
  triggered_by_user_id uuid references auth.users(id),
  created_at          timestamptz not null default now()
);

create index idx_automation_runs_aid_started on automation_runs (automation_id, started_at desc);
create index idx_automation_runs_failed     on automation_runs (started_at desc) where status != 'success';

-- RLS: alleen admins via authenticated session lezen, service-role schrijft
alter table automation_runs enable row level security;

create policy "automation_runs admin read"
  on automation_runs for select
  to authenticated
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    or coalesce((auth.jwt() ->> 'email') = any (string_to_array(coalesce(current_setting('app.admin_emails', true), ''), ',')), false)
  );

-- Geen INSERT/UPDATE/DELETE policy → alleen service-role kan schrijven (bypassed RLS).
