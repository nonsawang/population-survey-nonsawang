BEGIN;
ALTER TABLE public.house_gps_queue DROP CONSTRAINT house_gps_queue_state_check;
ALTER TABLE public.house_gps_queue ADD CONSTRAINT house_gps_queue_state_check CHECK(state IN ('pending','processing','sent','conflict','superseded','cancelled'));
CREATE TABLE public.house_gps_clear_history(
 id uuid PRIMARY KEY, moo text NOT NULL, address text NOT NULL, actor text NOT NULL,
 reason text NOT NULL, before_coordinates jsonb NOT NULL, cancelled_ids jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.house_gps_clear_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.house_gps_clear_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.house_gps_clear_history TO service_role;
CREATE FUNCTION public.house_gps_clear_web(p_id uuid,p_moo text,p_house text,p_expected jsonb,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a jsonb:=public.app_current_user(); old jsonb; ids jsonb; r record; latest_result timestamptz;
BEGIN
 IF a->>'userId' IS NULL OR coalesce(a->>'role','') NOT IN ('staff','admin','vhv') OR NOT coalesce(app_private.in_scope(p_moo),false) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_id IS NULL OR p_house IS NULL OR trim(p_house)='' OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 3 AND 500 OR jsonb_typeof(p_expected) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_CLEAR'; END IF;
 -- Serialize with existing request/revise/claim operations, including new queue inserts.
 LOCK TABLE public.house_gps_queue IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO r FROM public.house_gps_clear_history WHERE id=p_id;
 IF FOUND THEN
  IF r.actor IS DISTINCT FROM a->>'userId' OR r.moo<>p_moo OR r.address<>trim(p_house) OR NOT(r.before_coordinates @> p_expected AND p_expected @> r.before_coordinates) OR r.reason<>trim(p_reason) THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  RETURN jsonb_build_object('cleared',true,'id',p_id);
 END IF;
 PERFORM 1 FROM public.population WHERE moo::text=p_moo AND house=trim(p_house) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'HOUSE_NOT_FOUND'; END IF;
 IF a->>'role'='vhv' AND (trim(coalesce(a->>'displayName',''))='' OR EXISTS (
  SELECT 1 FROM public.population WHERE moo::text=p_moo AND house=trim(p_house)
  AND regexp_replace(trim(coalesce(vhv,'')),'\s+',' ','g')<>regexp_replace(trim(a->>'displayName'),'\s+',' ','g')
 )) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT jsonb_agg(jsonb_build_object('person_id',person_id::text,'latitude',latitude::double precision,'longitude',longitude::double precision) ORDER BY person_id::text)
 INTO old FROM public.population WHERE moo::text=p_moo AND house=trim(p_house);
 IF NOT(old @> p_expected AND p_expected @> old) OR jsonb_array_length(old)<>jsonb_array_length(p_expected) THEN RAISE EXCEPTION 'GPS_REFERENCE_CHANGED'; END IF;
 IF EXISTS(SELECT 1 FROM public.house_gps_queue WHERE moo=p_moo AND address=trim(p_house) AND state='processing') THEN RAISE EXCEPTION 'GPS_PROCESSING'; END IF;
 SELECT max(finished_at) INTO latest_result FROM public.house_gps_queue WHERE moo=p_moo AND address=trim(p_house) AND state IN ('sent','conflict');
 IF latest_result IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.house_gps_batches WHERE completed_at IS NOT NULL AND captured_at>latest_result AND captured_at>now()-interval '24 hours') THEN RAISE EXCEPTION 'GPS_SNAPSHOT_AFTER_RESULT_REQUIRED'; END IF;
 WITH cancelled AS (
 UPDATE public.house_gps_queue SET state='cancelled',finished_at=now() WHERE moo=p_moo AND address=trim(p_house) AND state='pending' RETURNING id
 ) SELECT coalesce(jsonb_agg(id),'[]'::jsonb) INTO ids FROM cancelled;
 INSERT INTO public.house_gps_clear_history VALUES(p_id,p_moo,trim(p_house),a->>'userId',trim(p_reason),old,ids,now());
 UPDATE public.population SET latitude=NULL,longitude=NULL,updated_at=now() WHERE moo::text=p_moo AND house=trim(p_house);
 RETURN jsonb_build_object('cleared',true,'id',p_id);
END $$;
REVOKE ALL ON FUNCTION public.house_gps_clear_web(uuid,text,text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.house_gps_clear_web(uuid,text,text,jsonb,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
