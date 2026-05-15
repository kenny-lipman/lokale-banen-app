-- werkenindekempen_scrape_queue: Queue voor orchestrator/worker pattern (Fase 2).
-- URL = primary key, één URL kan max 1 keer in queue staan tegelijk.
-- Service-role-only access, geen RLS-policies (zoals password_reset_tokens / sales_lead_runs).

create table werkenindekempen_scrape_queue (
  url               text primary key,
  orchestration_id  text not null,
  enqueued_at       timestamptz not null default now(),
  picked_at         timestamptz,
  completed_at      timestamptz,
  status            text not null default 'pending'
                    check (status in ('pending','processing','success','error','validation_failed')),
  attempts          smallint not null default 0,
  error_message     text,
  result_stats      jsonb
);

create index idx_wik_queue_orch on werkenindekempen_scrape_queue (orchestration_id);
create index idx_wik_queue_pending on werkenindekempen_scrape_queue (status, enqueued_at) where status='pending';

alter table werkenindekempen_scrape_queue enable row level security;

comment on table werkenindekempen_scrape_queue is 'Queue voor werkenindekempen-scraper orchestrator/worker pattern (Fase 2). URL = primary key.';
