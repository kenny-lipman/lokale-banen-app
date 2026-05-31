-- Verwijder de redundante FK fk_cities_platforms op public.cities.
-- Deze constraint was identiek aan cities_platform_id_fkey
-- (FOREIGN KEY (platform_id) REFERENCES platforms(id)).
-- De dubbele FK maakte elke PostgREST-embed tussen cities en platforms
-- ambigu ("Could not embed because more than one relationship was found
-- for 'cities' and 'platforms'"), o.a. in SupabaseService.getActiveRegions.
-- cities_platform_id_fkey blijft over als enige relatie.
ALTER TABLE public.cities DROP CONSTRAINT IF EXISTS fk_cities_platforms;
