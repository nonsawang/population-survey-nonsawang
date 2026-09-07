-- Run in Supabase SQL Editor, NOT the HOSxP MariaDB database.
-- Back up the population table before deployment. Deploy the matching app
-- with this migration; older clients must stop writing Type 0/4 as statuses.
BEGIN;
ALTER TABLE public.population ADD COLUMN IF NOT EXISTS person_discharge_id integer;
ALTER TABLE public.population ADD COLUMN IF NOT EXISTS legacy_residency_type text;
ALTER TABLE public.population ADD COLUMN IF NOT EXISTS status_model_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.population ALTER COLUMN residency_type DROP NOT NULL;

-- Keep an access-restricted snapshot for review/recovery. Re-running the
-- migration leaves the original snapshot unchanged.
CREATE TABLE IF NOT EXISTS public.population_status_backup_20260907 AS
SELECT person_id, residency_type, person_discharge_id,
       legacy_residency_type, status_model_version
FROM public.population;
ALTER TABLE public.population_status_backup_20260907 ENABLE ROW LEVEL SECURITY;

-- Old Type 0 was used for both discharge and outside-area entries. Review it.
-- Old Type 4 means deceased; its original residence type is unknown.
UPDATE public.population
SET legacy_residency_type = residency_type::text,
    person_discharge_id = CASE trim(coalesce(residency_type::text, ''))
      WHEN '0' THEN NULL WHEN '4' THEN 1 ELSE 9 END,
    residency_type = CASE WHEN trim(coalesce(residency_type::text, '')) IN ('0','4')
      THEN NULL ELSE residency_type END,
    status_model_version = 1
WHERE status_model_version = 0;

-- Version 0 remains the default: clients not yet updated cannot silently
-- create records whose old Type 0/4 values are interpreted as new codes.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.population'::regclass AND conname = 'population_discharge_code_check') THEN
    ALTER TABLE public.population ADD CONSTRAINT population_discharge_code_check
      CHECK (person_discharge_id IS NULL OR person_discharge_id IN (1,2,3,9));
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Post-migration review, aggregate only.
SELECT legacy_residency_type, person_discharge_id, count(*) AS records
FROM public.population WHERE legacy_residency_type IN ('0','4')
GROUP BY legacy_residency_type, person_discharge_id;
