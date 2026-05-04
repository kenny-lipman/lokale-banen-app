-- Vertrouwelijke kolommen op `public.platforms` afschermen van de anon-rol.
--
-- Ondanks de RLS-policy `public_read_public_platforms` (filtert op
-- `is_public = true`) lekten alle kolommen — inclusief `indexnow_key`
-- (search-engine ping-secret), `instantly_campaign_id`, `mailerlite_group_id`,
-- en interne flags zoals `scraping_priority`. Een aanvaller kon via
-- `/rest/v1/platforms?is_public=eq.true&select=indexnow_key,…` deze data
-- voor alle live platforms harvesten.
--
-- Fix: column-level GRANT voor anon. RLS bepaalt nog steeds welke rijen
-- zichtbaar zijn (alleen public=true); deze grant beperkt welke kolommen
-- binnen die rijen leesbaar zijn. Service-role bypasses grants en houdt
-- volledige toegang voor admin/server-side flows.
--
-- Whitelist = exact de kolommen die public-sites nodig heeft om de tenant-
-- pagina, sitemap, llms.txt en RSL feed te renderen.

revoke select on public.platforms from anon;

grant select (
  id,
  regio_platform,
  central_place,
  domain,
  preview_domain,
  is_public,
  tier,
  logo_url,
  primary_color,
  secondary_color,
  tertiary_color,
  hero_title,
  hero_subtitle,
  seo_description,
  about_text,
  contact_email,
  contact_phone,
  social_linkedin,
  social_instagram,
  social_facebook,
  social_tiktok,
  social_twitter,
  favicon_url,
  og_image_url,
  privacy_text,
  terms_text
) on public.platforms to anon;
