-- Keep only the latest completed HOSxP review snapshot, active 2-hour review buffer,
-- and 100% of rows referenced by hosxp_review_approvals. Prune old batches and expired
-- review sessions/attempts automatically on each sync and warn from 350 MB (70% of 500 MB).
CREATE OR REPLACE FUNCTION public.hosxp_review_maintain() RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET lock_timeout = '5s'
AS $fn$
DECLARE
  ids text[];
  nr bigint := 0;
  nb bigint := 0;
  size_bytes bigint;
  snap_bytes bigint;
  gps_snap_bytes bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('hosxp-review-refresh-v2'));
  LOCK TABLE public.hosxp_review_batches, public.hosxp_review_approvals, public.hosxp_review_snapshot IN SHARE ROW EXCLUSIVE MODE;

  ids := ARRAY(
    SELECT b.id
      FROM public.hosxp_review_batches b
     WHERE b.captured_at < now() - interval '2 hours'
       AND b.id IS DISTINCT FROM (
         SELECT id
           FROM public.hosxp_review_batches
          WHERE completed_at IS NOT NULL
          ORDER BY captured_at DESC, id DESC
          LIMIT 1
       )
       AND EXISTS (SELECT 1 FROM public.hosxp_review_batches WHERE completed_at IS NOT NULL)
       AND (
         EXISTS (
           SELECT 1
             FROM public.hosxp_review_snapshot s
            WHERE s.batch_id = b.id
              AND NOT EXISTS (
                SELECT 1
                  FROM public.hosxp_review_approvals a
                 WHERE a.batch_id = s.batch_id
                   AND a.target_person_id = s.hosxp_person_id
              )
         )
         OR NOT EXISTS (
           SELECT 1
             FROM public.hosxp_review_approvals a
            WHERE a.batch_id = b.id
         )
       )
     ORDER BY b.captured_at, b.id
     LIMIT 50
  );

  DELETE FROM public.hosxp_review_snapshot s
   WHERE s.batch_id = ANY(ids)
     AND NOT EXISTS (
       SELECT 1
         FROM public.hosxp_review_approvals a
        WHERE a.batch_id = s.batch_id
          AND a.target_person_id = s.hosxp_person_id
     );
  GET DIAGNOSTICS nr = ROW_COUNT;

  DELETE FROM public.hosxp_review_batches b
   WHERE b.id = ANY(ids)
     AND NOT EXISTS (
       SELECT 1
         FROM public.hosxp_review_approvals a
        WHERE a.batch_id = b.id
     );
  GET DIAGNOSTICS nb = ROW_COUNT;

  IF to_regclass('public.hosxp_review_sessions') IS NOT NULL THEN
    EXECUTE $q$DELETE FROM public.hosxp_review_sessions WHERE expires_at < now() - interval '7 days'$q$;
  END IF;

  IF to_regclass('public.hosxp_review_login_attempts') IS NOT NULL THEN
    EXECUTE $q$DELETE FROM public.hosxp_review_login_attempts WHERE attempted_at < now() - interval '30 days'$q$;
  END IF;

  size_bytes := pg_database_size(current_database());
  snap_bytes := pg_total_relation_size('public.hosxp_review_snapshot');

  INSERT INTO public.hosxp_review_storage_daily(day, database_bytes, snapshot_bytes, checked_at)
  VALUES ((now() AT TIME ZONE 'Asia/Bangkok')::date, size_bytes, snap_bytes, now())
  ON CONFLICT (day) DO UPDATE
    SET database_bytes = excluded.database_bytes,
        snapshot_bytes = excluded.snapshot_bytes,
        checked_at = excluded.checked_at;
  DELETE FROM public.hosxp_review_storage_daily WHERE day < (now() AT TIME ZONE 'Asia/Bangkok')::date - 90;

  IF to_regclass('public.house_gps_storage_daily') IS NOT NULL
     AND to_regclass('public.house_gps_snapshot') IS NOT NULL THEN
    gps_snap_bytes := pg_total_relation_size('public.house_gps_snapshot');
    EXECUTE $q$
      INSERT INTO public.house_gps_storage_daily(day, database_bytes, snapshot_bytes, warning, checked_at)
      VALUES ((now() AT TIME ZONE 'Asia/Bangkok')::date, $1, $2, $1 >= 350000000, now())
      ON CONFLICT (day) DO UPDATE
        SET database_bytes = excluded.database_bytes,
            snapshot_bytes = excluded.snapshot_bytes,
            warning = excluded.warning,
            checked_at = excluded.checked_at
    $q$ USING size_bytes, gps_snap_bytes;
  END IF;

  RETURN jsonb_build_object(
    'deleted_rows', nr,
    'deleted_batches', nb,
    'database_bytes', size_bytes,
    'snapshot_bytes', snap_bytes,
    'warning', size_bytes >= 350000000
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.hosxp_review_maintain() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hosxp_review_maintain() TO service_role;
NOTIFY pgrst, 'reload schema';
