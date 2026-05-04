-- Atomic publish-update voor platforms.
--
-- - is_public = true gezet
-- - updated_at op now()
-- - published_at alleen geschreven wanneer hij nog NULL is (immutable
--   na first publish, ook onder concurrent requests)
--
-- Implementatie via COALESCE in een single UPDATE — voorkomt de race
-- waarbij twee parallelle publishes beide `published_at IS NULL` lezen
-- en beide hun eigen `now()` schrijven (last-write-wins).
create or replace function public.publish_platform_atomic(p_id uuid)
returns public.platforms
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.platforms;
begin
  update public.platforms
  set
    is_public = true,
    updated_at = now(),
    published_at = coalesce(published_at, now())
  where id = p_id
  returning * into result;

  if not found then
    raise exception 'Platform not found' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

revoke all on function public.publish_platform_atomic(uuid) from public;
grant execute on function public.publish_platform_atomic(uuid) to service_role;
