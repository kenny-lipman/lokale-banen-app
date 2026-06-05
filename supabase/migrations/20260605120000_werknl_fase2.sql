-- werk.nl scraper Fase 2: detail-verrijking + company-dedup.
-- Eigen queue/RPC (ADR 0001), dedup-kolom, bemiddelaar-tag (CONTEXT.md), vervaldatum, do-not-approach.

-- ── Queue (detail-verrijking) ─────────────────────────────────────────────
-- Service-role only, RLS aan, geen policies (zoals werkenindekempen_scrape_queue).
create table werk_nl_scrape_queue (
  job_posting_id    uuid primary key references job_postings(id) on delete cascade,
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
create index idx_werknl_queue_orch on werk_nl_scrape_queue (orchestration_id);
create index idx_werknl_queue_pending on werk_nl_scrape_queue (status, enqueued_at) where status = 'pending';
alter table werk_nl_scrape_queue enable row level security;
comment on table werk_nl_scrape_queue is 'Queue voor werk.nl detail-verrijking (Fase 2). job_posting_id = primary key. Service-role only.';

-- ── Atomic claim RPC (kopie wik_claim_batch, op job_posting_id) ────────────
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
    where q.orchestration_id = p_orchestration_id
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
revoke all on function werknl_claim_batch(text, int) from public, anon, authenticated;
grant execute on function werknl_claim_batch(text, int) to service_role;
comment on function werknl_claim_batch is 'Atomic claim van N pending werk.nl queue-rijen. Service-role only.';

-- ── Company-dedup laag 1: stabiele werk.nl bedrijfs-id ────────────────────
alter table companies add column werknl_employer_id text;
create unique index uq_companies_werknl_employer_id
  on companies (werknl_employer_id) where werknl_employer_id is not null;
comment on column companies.werknl_employer_id is 'werk.nl employer.referenceNumber (dedup-laag 1).';

-- ── Bemiddelaar vs eindwerkgever (systeembreed, CONTEXT.md) ───────────────
-- werk.nl heeft geen schoon signaal; gevuld via keyword-heuristiek op naam/website.
alter table companies add column is_bemiddelaar boolean not null default false;
comment on column companies.is_bemiddelaar is 'Bedrijf is een bemiddelaar (uitzend/detach/werving), geen eindwerkgever. Bronoverstijgend.';

-- ── Vacature-vervaldatum (werk.nl expirationDate) ─────────────────────────
alter table job_postings add column expires_at timestamptz;
comment on column job_postings.expires_at is 'Vervaldatum uit de bron (werk.nl expirationDate). Verstreken -> archiveren.';

-- ── Do-not-approach signaal voor lead-gen ─────────────────────────────────
alter table job_postings add column acquisition_not_appreciated boolean not null default false;
comment on column job_postings.acquisition_not_appreciated is 'Bron geeft aan: acquisitie n.a.v. deze vacature niet gewenst. Sales filtert hierop.';
