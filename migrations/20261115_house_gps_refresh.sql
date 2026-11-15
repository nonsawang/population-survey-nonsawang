BEGIN;
CREATE TABLE public.house_gps_refresh_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','completed','failed')),
 requested_at timestamptz NOT NULL DEFAULT now(),started_at timestamptz,finished_at timestamptz,
 house_count integer,error_code text
);
CREATE UNIQUE INDEX house_gps_refresh_one_active ON public.house_gps_refresh_requests((true)) WHERE state IN ('pending','processing');
ALTER TABLE public.house_gps_refresh_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.house_gps_refresh_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.house_gps_refresh_requests TO service_role;
CREATE FUNCTION public.house_gps_refresh_status() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a jsonb:=public.app_current_user(); r jsonb;b jsonb;
BEGIN
 IF a->>'userId' IS NULL OR coalesce(a->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT to_jsonb(t) INTO r FROM (SELECT id,state,requested_at,started_at,finished_at,house_count,error_code FROM public.house_gps_refresh_requests ORDER BY requested_at DESC,id DESC LIMIT 1)t;
 SELECT jsonb_build_object('captured_at',captured_at,'completed_at',completed_at) INTO b FROM public.house_gps_batches WHERE completed_at IS NOT NULL ORDER BY captured_at DESC,id DESC LIMIT 1;
 RETURN jsonb_build_object('request',r,'snapshot',b);
END $$;
CREATE FUNCTION public.house_gps_refresh_request() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a jsonb:=public.app_current_user();
BEGIN
 IF a->>'userId' IS NULL OR coalesce(a->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(15112026,8189);
 IF NOT EXISTS(SELECT 1 FROM public.house_gps_refresh_requests WHERE state IN ('pending','processing') OR requested_at>now()-interval '1 minute') THEN
 INSERT INTO public.house_gps_refresh_requests(actor) VALUES(a->>'userId');
 END IF;
 RETURN public.house_gps_refresh_status();
END $$;
CREATE FUNCTION public.house_gps_refresh_claim() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE job uuid;
BEGIN
 UPDATE public.house_gps_refresh_requests SET state='processing',started_at=now()
 WHERE id=(SELECT id FROM public.house_gps_refresh_requests WHERE state='pending' ORDER BY requested_at LIMIT 1 FOR UPDATE SKIP LOCKED)
 RETURNING id INTO job;
 RETURN job;
END $$;
CREATE FUNCTION public.house_gps_refresh_finish(p_id uuid,p_success boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n integer;
BEGIN
 IF p_success IS NULL THEN RAISE EXCEPTION 'INVALID_RESULT'; END IF;
 IF p_success THEN
  IF NOT EXISTS(SELECT 1 FROM public.house_gps_batches WHERE id=p_id AND completed_at IS NOT NULL) THEN RAISE EXCEPTION 'SNAPSHOT_INCOMPLETE'; END IF;
  SELECT count(*) INTO n FROM public.house_gps_snapshot WHERE batch_id=p_id;
  IF n=0 THEN RAISE EXCEPTION 'SNAPSHOT_INCOMPLETE'; END IF;
 END IF;
 UPDATE public.house_gps_refresh_requests SET state=CASE WHEN p_success THEN 'completed' ELSE 'failed' END,finished_at=now(),house_count=n,error_code=CASE WHEN p_success THEN NULL ELSE 'LAN_REFRESH_FAILED' END WHERE id=p_id AND state='processing';
END $$;
REVOKE ALL ON FUNCTION public.house_gps_refresh_request(),public.house_gps_refresh_status(),public.house_gps_refresh_claim(),public.house_gps_refresh_finish(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.house_gps_refresh_request(),public.house_gps_refresh_status() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.house_gps_refresh_claim(),public.house_gps_refresh_finish(uuid,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
