-- Migration: Seed central places data
-- This script populates the regio_platform_central_places table with optimal central places
-- based on analysis of existing regions data

-- Insert central place assignments based on analysis of regions data
-- The central place is typically the most prominent city in each platform
INSERT INTO public.regio_platform_central_places (regio_platform, central_place, central_postcode, scraping_priority) VALUES
-- Major platforms with clear central cities
('HaagseBanen', 'Den Haag', '2500', 1),
('ZaanseBanen', 'Zaandam', '1501', 1),
('AlkmaarseBanen', 'Alkmaar', '1800', 1),
('HaarlemseBanen', 'Haarlem', '2000', 1),
('TilburgseBanen', 'Tilburg', '5000', 1),
('AlmeerseBanen', 'Almere', '1300', 1),
('ApeldoornseBanen', 'Apeldoorn', '7300', 1),
('SchiedamseBanen', 'Schiedam', '3100', 1),
('DrechtseBanen', 'Dordrecht', '3300', 1),
('VoornseBanen', 'Voorburg', '2200', 1),

-- Additional platforms (add more as needed)
('AmsterdamseBanen', 'Amsterdam', '1000', 1),
('RotterdamseBanen', 'Rotterdam', '3000', 1),
('UtrechtseBanen', 'Utrecht', '3500', 1),
('EindhovenseBanen', 'Eindhoven', '5600', 1),
('GroningseBanen', 'Groningen', '9700', 1),
('LeidseBanen', 'Leiden', '2300', 1),
('DelftseBanen', 'Delft', '2600', 1),
('GoudseBanen', 'Gouda', '2800', 1),
('BredaseBanen', 'Breda', '4800', 1),
('NijmeegseBanen', 'Nijmegen', '6500', 1),

-- Handle conflicts by updating existing records
ON CONFLICT (regio_platform) DO UPDATE SET
    central_place = EXCLUDED.central_place,
    central_postcode = EXCLUDED.central_postcode,
    scraping_priority = EXCLUDED.scraping_priority,
    updated_at = now();

-- Verify the seeding was successful
-- This query should return the count of seeded central places
SELECT COUNT(*) as seeded_central_places FROM public.regio_platform_central_places WHERE is_active = true; 