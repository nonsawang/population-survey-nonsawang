BEGIN;
-- Equivalent to app_private.in_scope(moo), but resolve the session once per
-- statement instead of looking it up again for every population row.
ALTER POLICY population_read ON public.population USING (
 coalesce(CASE
 WHEN (SELECT public.app_current_user()->>'role') IN ('admin','staff','manager') THEN true
 WHEN (SELECT public.app_current_user()->>'role')='vhv' THEN
   trim(moo)=ANY(regexp_split_to_array(trim((SELECT public.app_current_user()->>'moo')),'\s*,\s*'))
   AND trim(coalesce(moo,''))<>''
 ELSE false END,false)
);
COMMIT;
