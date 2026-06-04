-- company-logos storage bucket voor bedrijfslogo-uploads en auto-fetch.
-- Public zodat de geconstrueerde public URL leesbaar is; uploads gaan via
-- service-role (bypasst RLS) of via signed upload URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-logos',
  'company-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;
