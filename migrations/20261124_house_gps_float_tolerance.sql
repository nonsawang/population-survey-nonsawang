BEGIN;
-- Tolerate PostgREST extra_float_digits=0 (15 sig-digit) rounding when comparing
-- double precision queue coordinates (~1e-9 deg <= 0.11 mm tolerance), while
-- keeping HOSxP old_latitude/old_longitude text reference checks exact.
CREATE OR REPLACE FUNCTION public.house_gps_approve(p_id uuid,p_lat double precision,p_lng double precision) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a jsonb:=public.app_current_user(); q record;
BEGIN
 SELECT * INTO q FROM public.house_gps_queue WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF a->>'userId' IS NULL OR coalesce(a->>'role','') NOT IN ('staff','admin') OR NOT coalesce(app_private.in_scope(q.moo),false) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF q.state<>'pending' THEN RAISE EXCEPTION 'REVISION_STATE_CHANGED'; END IF;
 IF NOT coalesce(
   p_lat BETWEEN -90 AND 90
   AND p_lng BETWEEN -180 AND 180
   AND abs(q.latitude - p_lat) <= 1e-9
   AND abs(q.longitude - p_lng) <= 1e-9,
   false
 ) THEN RAISE EXCEPTION 'GPS_REFERENCE_CHANGED'; END IF;
 UPDATE public.house_gps_queue SET approved_by=coalesce(approved_by,a->>'userId'),approved_at=coalesce(approved_at,now()) WHERE id=p_id;
 RETURN jsonb_build_object('id',p_id,'state','pending','approved',true);
END $$;

CREATE OR REPLACE FUNCTION public.house_gps_batch_review(p_items jsonb,p_approve boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a jsonb:=public.app_current_user(); item jsonb; q public.house_gps_queue; ctx jsonb; results jsonb:='[]'; reason text; outcome text;
BEGIN
 IF a->>'userId' IS NULL OR coalesce(a->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_approve IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_BATCH'; END IF;
 IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 25 OR
 (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_items))<>jsonb_array_length(p_items) THEN RAISE EXCEPTION 'INVALID_BATCH'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'id' LOOP
  BEGIN
   SELECT * INTO q FROM public.house_gps_queue WHERE id=(item->>'id')::uuid FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
   IF NOT coalesce(app_private.in_scope(q.moo),false) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
   IF q.state<>'pending' THEN RAISE EXCEPTION 'NOT_PENDING'; END IF;
   IF q.approved_at IS NOT NULL OR q.approved_by IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_APPROVED'; END IF;
   IF NOT coalesce(
     (item->>'latitude')::double precision BETWEEN -90 AND 90
     AND (item->>'longitude')::double precision BETWEEN -180 AND 180
     AND abs(q.latitude - (item->>'latitude')::double precision) <= 1e-9
     AND abs(q.longitude - (item->>'longitude')::double precision) <= 1e-9,
     false
   ) THEN RAISE EXCEPTION 'GPS_REFERENCE_CHANGED'; END IF;
   ctx:=public.house_gps_revision_context(q.id);
   IF q.old_latitude IS DISTINCT FROM ctx->>'latitude' OR q.old_longitude IS DISTINCT FROM ctx->>'longitude' THEN RAISE EXCEPTION 'GPS_REFERENCE_CHANGED'; END IF;
   IF p_approve AND (item->>'batchId' IS NULL OR item->>'batchId' IS DISTINCT FROM ctx->>'batchId') THEN RAISE EXCEPTION 'GPS_REFERENCE_CHANGED'; END IF;
   IF p_approve THEN
    PERFORM public.house_gps_approve(q.id,q.latitude,q.longitude);
    outcome:='approved';
   ELSE outcome:='ready'; END IF;
   results:=results||jsonb_build_array(jsonb_build_object('id',q.id,'status',outcome,'moo',q.moo,'address',q.address,'latitude',q.latitude,'longitude',q.longitude,'oldLatitude',q.old_latitude,'oldLongitude',q.old_longitude,'batchId',ctx->>'batchId','capturedAt',ctx->>'capturedAt'));
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS reason=MESSAGE_TEXT;
   IF reason NOT IN ('NOT_FOUND','FORBIDDEN','NOT_PENDING','ALREADY_APPROVED','GPS_REFERENCE_CHANGED','GPS_SNAPSHOT_REQUIRED','HOUSE_NOT_UNIQUE','HOUSE_CHANGED','ALREADY_REPLACED','REVISION_STATE_CHANGED') THEN reason:='CHECK_FAILED'; END IF;
   results:=results||jsonb_build_array(jsonb_build_object('id',item->>'id','status','skipped','reason',reason));
  END;
 END LOOP;
 RETURN jsonb_build_object('rows',results);
END $$;

REVOKE ALL ON FUNCTION public.house_gps_approve(uuid,double precision,double precision), public.house_gps_batch_review(jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.house_gps_approve(uuid,double precision,double precision), public.house_gps_batch_review(jsonb,boolean) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
