BEGIN;
CREATE TABLE public.house_gps_batches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),captured_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz);
CREATE TABLE public.house_gps_snapshot(batch_id uuid REFERENCES public.house_gps_batches(id),house_id text,village_id text,moo text,address text,latitude text,longitude text,PRIMARY KEY(batch_id,house_id));
CREATE TABLE public.house_gps_queue(
 id uuid PRIMARY KEY,house_id text NOT NULL,village_id text NOT NULL,moo text NOT NULL,address text NOT NULL,
 old_latitude text,old_longitude text,latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),accuracy double precision NOT NULL CHECK(accuracy BETWEEN 0 AND 100),
 actor text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','sent','conflict')),finished_at timestamptz
);
CREATE UNIQUE INDEX house_gps_pending ON public.house_gps_queue(house_id) WHERE state IN ('pending','processing');
ALTER TABLE public.house_gps_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_gps_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_gps_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.house_gps_batches,public.house_gps_snapshot,public.house_gps_queue FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.house_gps_batches,public.house_gps_snapshot TO service_role;
GRANT SELECT ON public.house_gps_queue TO service_role;
CREATE FUNCTION public.house_gps_request(p_id uuid,p_moo text,p_house text,p_lat double precision,p_lng double precision,p_accuracy double precision) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a jsonb:=public.app_current_user(); b uuid;s record;q record;n integer;
BEGIN
 IF a->>'userId' IS NULL OR coalesce(a->>'role','') NOT IN ('admin','staff','vhv') OR NOT coalesce(app_private.in_scope(p_moo),false) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_id IS NULL OR p_lat IS NULL OR p_lng IS NULL OR p_accuracy IS NULL OR NOT(p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180 AND p_accuracy BETWEEN 0 AND 100) THEN RAISE EXCEPTION 'INVALID_GPS'; END IF;
 SELECT * INTO q FROM public.house_gps_queue WHERE id=p_id;
 IF FOUND THEN
 IF q.actor<>a->>'userId' OR q.moo<>p_moo OR q.address<>trim(p_house) OR q.latitude<>p_lat OR q.longitude<>p_lng OR q.accuracy<>p_accuracy THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
 RETURN jsonb_build_object('id',q.id,'state',q.state);END IF;
 SELECT id INTO b FROM public.house_gps_batches WHERE completed_at IS NOT NULL AND captured_at>now()-interval '24 hours' ORDER BY captured_at DESC,id DESC LIMIT 1;
 IF b IS NULL THEN RAISE EXCEPTION 'GPS_SNAPSHOT_REQUIRED'; END IF;
 SELECT count(*) INTO n FROM public.house_gps_snapshot WHERE batch_id=b AND moo=p_moo AND address=trim(p_house);
 IF n<>1 THEN RAISE EXCEPTION 'HOUSE_NOT_UNIQUE'; END IF;
 SELECT * INTO s FROM public.house_gps_snapshot WHERE batch_id=b AND moo=p_moo AND address=trim(p_house);
 INSERT INTO public.house_gps_queue(id,house_id,village_id,moo,address,old_latitude,old_longitude,latitude,longitude,accuracy,actor)
 VALUES(p_id,s.house_id,s.village_id,s.moo,s.address,s.latitude,s.longitude,p_lat,p_lng,p_accuracy,a->>'userId');
 UPDATE public.population SET latitude=p_lat,longitude=p_lng,updated_at=now() WHERE moo::text=p_moo AND house=trim(p_house);
 GET DIAGNOSTICS n=ROW_COUNT;IF n=0 THEN RAISE EXCEPTION 'HOUSE_NOT_FOUND';END IF;
 RETURN jsonb_build_object('id',p_id,'state','pending');
END $$;
CREATE FUNCTION public.house_gps_claim(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q record;BEGIN
 UPDATE public.house_gps_queue SET state='processing' WHERE id=p_id AND state='pending' RETURNING * INTO q;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_PENDING';END IF;RETURN to_jsonb(q);END $$;
CREATE FUNCTION public.house_gps_finish(p_id uuid,p_state text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q record;BEGIN
 IF p_state NOT IN ('sent','conflict') OR p_state IS NULL THEN RAISE EXCEPTION 'INVALID_STATE';END IF;
 SELECT * INTO q FROM public.house_gps_queue WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND';END IF;
 IF q.state=p_state THEN RETURN;END IF;
 IF q.state<>'processing' THEN RAISE EXCEPTION 'INVALID_STATE';END IF;
 UPDATE public.house_gps_queue SET state=p_state,finished_at=now() WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.house_gps_request(uuid,text,text,double precision,double precision,double precision),public.house_gps_claim(uuid),public.house_gps_finish(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.house_gps_request(uuid,text,text,double precision,double precision,double precision) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.house_gps_claim(uuid),public.house_gps_finish(uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
