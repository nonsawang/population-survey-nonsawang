BEGIN;
ALTER TABLE public.house_gps_queue DROP CONSTRAINT house_gps_queue_state_check;
ALTER TABLE public.house_gps_queue ADD CONSTRAINT house_gps_queue_state_check CHECK(state IN ('pending','processing','sent','conflict','superseded'));
ALTER TABLE public.house_gps_queue
 ADD COLUMN replaces_id uuid UNIQUE REFERENCES public.house_gps_queue(id),
 ADD COLUMN revision_reason text,
 ADD COLUMN reference_captured_at timestamptz;

CREATE FUNCTION public.house_gps_revision_context(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a jsonb:=public.app_current_user(); q record; b record; s record; n integer;
BEGIN
 SELECT * INTO q FROM public.house_gps_queue WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF a->>'userId' IS NULL OR coalesce(a->>'role','') NOT IN ('staff','admin') OR NOT coalesce(app_private.in_scope(q.moo),false) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF q.state NOT IN ('pending','sent','conflict') THEN RAISE EXCEPTION 'REVISION_STATE_CHANGED'; END IF;
 IF EXISTS(SELECT 1 FROM public.house_gps_queue WHERE replaces_id=q.id) THEN RAISE EXCEPTION 'ALREADY_REPLACED'; END IF;
 SELECT * INTO b FROM public.house_gps_batches WHERE completed_at IS NOT NULL AND captured_at>now()-interval '24 hours' ORDER BY captured_at DESC,id DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'GPS_SNAPSHOT_REQUIRED'; END IF;
 IF q.state IN ('sent','conflict') AND (q.finished_at IS NULL OR b.captured_at<=q.finished_at) THEN RAISE EXCEPTION 'GPS_SNAPSHOT_AFTER_RESULT_REQUIRED'; END IF;
 SELECT count(*) INTO n FROM public.house_gps_snapshot WHERE batch_id=b.id AND moo=q.moo AND address=q.address;
 IF n<>1 THEN RAISE EXCEPTION 'HOUSE_NOT_UNIQUE'; END IF;
 SELECT * INTO s FROM public.house_gps_snapshot WHERE batch_id=b.id AND house_id=q.house_id AND village_id=q.village_id AND moo=q.moo AND address=q.address;
 IF NOT FOUND THEN RAISE EXCEPTION 'HOUSE_CHANGED'; END IF;
 RETURN jsonb_build_object('batchId',b.id,'capturedAt',b.captured_at,'state',q.state,'latitude',s.latitude,'longitude',s.longitude);
END $$;

CREATE FUNCTION public.house_gps_revise(p_old_id uuid,p_id uuid,p_batch_id uuid,p_expected_state text,p_lat double precision,p_lng double precision,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a jsonb:=public.app_current_user(); q record; existing record; ctx jsonb; n integer;
BEGIN
 SELECT * INTO q FROM public.house_gps_queue WHERE id=p_old_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF a->>'userId' IS NULL OR coalesce(a->>'role','') NOT IN ('staff','admin') OR NOT coalesce(app_private.in_scope(q.moo),false) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_id IS NULL OR p_lat IS NULL OR p_lng IS NULL OR NOT(p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180) OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'INVALID_REVISION'; END IF;
 SELECT * INTO existing FROM public.house_gps_queue WHERE id=p_id;
 IF FOUND THEN
   IF existing.replaces_id IS DISTINCT FROM p_old_id OR existing.actor<>a->>'userId' OR existing.latitude<>p_lat OR existing.longitude<>p_lng OR existing.revision_reason<>trim(p_reason) THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
   RETURN jsonb_build_object('id',existing.id,'state',existing.state);
 END IF;
 IF q.state IS DISTINCT FROM p_expected_state THEN RAISE EXCEPTION 'REVISION_STATE_CHANGED'; END IF;
 ctx:=public.house_gps_revision_context(p_old_id);
 IF (ctx->>'batchId')::uuid IS DISTINCT FROM p_batch_id THEN RAISE EXCEPTION 'GPS_REFERENCE_CHANGED'; END IF;
 IF q.state='pending' THEN UPDATE public.house_gps_queue SET state='superseded',finished_at=now() WHERE id=q.id; END IF;
 INSERT INTO public.house_gps_queue(id,house_id,village_id,moo,address,old_latitude,old_longitude,latitude,longitude,accuracy,actor,replaces_id,revision_reason,reference_captured_at)
 VALUES(p_id,q.house_id,q.village_id,q.moo,q.address,ctx->>'latitude',ctx->>'longitude',p_lat,p_lng,q.accuracy,a->>'userId',q.id,trim(p_reason),(ctx->>'capturedAt')::timestamptz);
 UPDATE public.population SET latitude=p_lat,longitude=p_lng,updated_at=now() WHERE moo::text=q.moo AND house=q.address;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n=0 THEN RAISE EXCEPTION 'HOUSE_NOT_FOUND'; END IF;
 RETURN jsonb_build_object('id',p_id,'state','pending');
END $$;
REVOKE ALL ON FUNCTION public.house_gps_revision_context(uuid),public.house_gps_revise(uuid,uuid,uuid,text,double precision,double precision,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.house_gps_revision_context(uuid),public.house_gps_revise(uuid,uuid,uuid,text,double precision,double precision,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
