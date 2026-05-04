-- Publication invariants for the multi-tenant `platforms` table.
--
-- 1. RLS-policy verbreden: het `domain IS NOT NULL` filter sloot platforms
--    uit die alleen via `preview_domain` publiceren (bijv. *.vercel.app).
--    De anonieme rol moet die rijen nu wél kunnen lezen — `is_public = true`
--    is de enige juiste publiek-vlag.
-- 2. Unique index op `preview_domain`: voorkomt dat twee platforms dezelfde
--    host claimen, wat de tenant-lookup non-deterministisch zou maken.

drop policy if exists public_read_public_platforms on public.platforms;
create policy public_read_public_platforms on public.platforms
  for select
  to public
  using (is_public = true);

create unique index if not exists platforms_preview_domain_uniq
  on public.platforms (preview_domain)
  where preview_domain is not null;
