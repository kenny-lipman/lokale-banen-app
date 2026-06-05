-- werk.nl scraper Fase 3: delisting + cron-state.

-- ── Pass-state (singleton, eigen bounded context) ─────────────────────────
create table werk_nl_scan_state (
  id                 smallint primary key default 1 check (id = 1),
  pass_cursor        int not null default 0,
  pass_started_at    timestamptz,
  pass_completed_at  timestamptz
);
insert into werk_nl_scan_state (id) values (1);
alter table werk_nl_scan_state enable row level security;
comment on table werk_nl_scan_state is 'Singleton: voortgang van de werk.nl volledige-pass scan (cursor + pass-grenzen). Service-role only.';

-- ── claim_batch orchestratie-agnostisch maken (cron-worker drain) ─────────
-- null p_orchestration_id => claim oudste pending ongeacht orchestration.
create or replace function werknl_claim_batch(
  p_orchestration_id text,
  p_batch_size int
) returns table (job_posting_id uuid, attempts smallint)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select q.job_posting_id
    from werk_nl_scrape_queue q
    where (p_orchestration_id is null or q.orchestration_id = p_orchestration_id)
      and q.status = 'pending'
    order by q.enqueued_at asc
    limit p_batch_size
    for update skip locked
  )
  update werk_nl_scrape_queue q
     set status = 'processing',
         picked_at = now(),
         attempts = q.attempts + 1
   from picked
   where q.job_posting_id = picked.job_posting_id
  returning q.job_posting_id, q.attempts;
end;
$$;
