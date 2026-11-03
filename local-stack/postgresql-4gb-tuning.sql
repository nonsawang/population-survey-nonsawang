-- Tuning PostgreSQL 16 for a 4 GB RAM Windows PC (HP 280 G4 MT, i5-8500, SATA SSD)
-- Uses ~80-120 MB RAM instead of heavy server defaults.
ALTER SYSTEM SET shared_buffers = '128MB';
ALTER SYSTEM SET effective_cache_size = '512MB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '32MB';
ALTER SYSTEM SET max_connections = '35';
ALTER SYSTEM SET random_page_cost = '1.1';
SELECT pg_reload_conf();
