-- Rename nominatim_failed to geocoding_failed for semantic neutrality
-- (we're switching from public Nominatim to LocationIQ).
-- Add geocoding_failed_reason text column (used by F4 to record reason
-- like 'no_match', 'missing_postcode', etc).

alter table job_postings rename column nominatim_failed to geocoding_failed;
alter table job_postings add column geocoding_failed_reason text;
