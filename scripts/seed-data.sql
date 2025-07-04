-- Insert job sources
INSERT INTO job_sources (name, url) VALUES
('Indeed', 'https://indeed.nl'),
('LinkedIn', 'https://linkedin.com'),
('Andere', NULL)
ON CONFLICT DO NOTHING;

-- Insert regions
INSERT INTO regions (name, country) VALUES
('Noord-Holland', 'Netherlands'),
('Zuid-Holland', 'Netherlands'),
('Utrecht', 'Netherlands'),
('Noord-Brabant', 'Netherlands'),
('Gelderland', 'Netherlands')
ON CONFLICT DO NOTHING;

-- Insert sample companies
INSERT INTO companies (name, website, location) VALUES
('Transport Nederland BV', 'https://transportnederland.nl', 'Rotterdam'),
('Logistiek Partners', 'https://logistiekpartners.nl', 'Amsterdam'),
('Warehouse Solutions', 'https://warehousesolutions.nl', 'Utrecht'),
('Express Delivery', 'https://expressdelivery.nl', 'Den Haag'),
('Cargo Connect', 'https://cargoconnect.nl', 'Eindhoven')
ON CONFLICT DO NOTHING;

-- Insert sample job postings
WITH source_ids AS (
    SELECT id, name FROM job_sources
),
company_ids AS (
    SELECT id, name FROM companies
)
INSERT INTO job_postings (title, company_id, location, source_id, status, external_vacancy_id, scraped_at)
SELECT 
    job_data.title,
    c.id,
    job_data.location,
    s.id,
    job_data.status,
    job_data.external_id,
    job_data.scraped_at
FROM (
    VALUES
    ('Vrachtwagenchauffeur CE', 'Transport Nederland BV', 'Rotterdam', 'Indeed', 'active', 'IND001', '2024-01-15 10:30:00+00'),
    ('Heftruckchauffeur', 'Logistiek Partners', 'Amsterdam', 'LinkedIn', 'active', 'LI002', '2024-01-15 09:15:00+00'),
    ('Magazijnmedewerker', 'Warehouse Solutions', 'Utrecht', 'Indeed', 'inactive', 'IND003', '2024-01-14 16:45:00+00'),
    ('Chauffeur Distributie', 'Express Delivery', 'Den Haag', 'Andere', 'active', 'OTH004', '2024-01-14 14:20:00+00'),
    ('Vrachtwagenchauffeur C', 'Transport Nederland BV', 'Eindhoven', 'Indeed', 'active', 'IND005', '2024-01-14 11:30:00+00'),
    ('Logistiek Medewerker', 'Cargo Connect', 'Eindhoven', 'LinkedIn', 'active', 'LI006', '2024-01-14 08:45:00+00'),
    ('Reachtruckchauffeur', 'Warehouse Solutions', 'Utrecht', 'Indeed', 'active', 'IND007', '2024-01-13 15:20:00+00'),
    ('Vrachtwagenchauffeur CE International', 'Transport Nederland BV', 'Rotterdam', 'LinkedIn', 'active', 'LI008', '2024-01-13 12:10:00+00')
) AS job_data(title, company_name, location, source_name, status, external_id, scraped_at)
JOIN company_ids c ON c.name = job_data.company_name
JOIN source_ids s ON s.name = job_data.source_name
ON CONFLICT DO NOTHING;
