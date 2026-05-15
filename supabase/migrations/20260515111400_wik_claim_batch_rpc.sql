-- RPC voor atomic claim van pending queue-rijen.
-- SELECT … FOR UPDATE SKIP LOCKED voorkomt dat parallelle workers dezelfde URL pakken.

create or replace function wik_claim_batch(
  p_orchestration_id text,
  p_batch_size int
) returns table (url text, attempts smallint)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select q.url
    from werkenindekempen_scrape_queue q
    where q.orchestration_id = p_orchestration_id
      and q.status = 'pending'
    order by q.enqueued_at asc
    limit p_batch_size
    for update skip locked
  )
  update werkenindekempen_scrape_queue q
     set status = 'processing',
         picked_at = now(),
         attempts = q.attempts + 1
   from picked
   where q.url = picked.url
  returning q.url, q.attempts;
end;
$$;

revoke all on function wik_claim_batch(text, int) from public, anon, authenticated;
grant execute on function wik_claim_batch(text, int) to service_role;
comment on function wik_claim_batch is 'Atomic claim van N pending queue-rijen voor werkenindekempen worker. Service-role only.';
