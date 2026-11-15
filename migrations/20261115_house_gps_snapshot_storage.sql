BEGIN;
ALTER TABLE public.house_gps_refresh_requests ADD COLUMN result_batch_id uuid;
CREATE TABLE public.house_gps_storage_daily(day date PRIMARY KEY,database_bytes bigint NOT NULL,snapshot_bytes bigint NOT NULL,warning boolean NOT NULL,checked_at timestamptz NOT NULL);
ALTER TABLE public.house_gps_storage_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.house_gps_storage_daily FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.house_gps_storage_daily TO service_role;
ALTER TABLE public.house_gps_batches ADD COLUMN source_name text, ADD COLUMN evidence_pinned boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.house_gps_snapshot_publish(p_id uuid,p_captured timestamptz,p_rows jsonb,p_source text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE latest public.house_gps_batches; n integer; same boolean; target uuid; nr bigint;nb bigint;size_bytes bigint;state text;source text;
BEGIN
 PERFORM pg_advisory_xact_lock(15112026,8190);
 LOCK TABLE public.house_gps_queue IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.house_gps_batches,public.house_gps_snapshot IN SHARE ROW EXCLUSIVE MODE;
 IF p_id IS NULL OR p_captured IS NULL OR p_captured>now()+interval '5 minutes' OR p_captured<now()-interval '1 hour' OR p_source IS NULL OR p_source='' OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_SNAPSHOT'; END IF;
 n:=jsonb_array_length(p_rows);
 IF n NOT BETWEEN 1 AND 100000 OR EXISTS(SELECT 1 FROM jsonb_to_recordset(p_rows) x(house_id text,village_id text) WHERE coalesce(x.house_id,'')='' OR coalesce(x.village_id,'')='') OR (SELECT count(DISTINCT value->>'house_id') FROM jsonb_array_elements(p_rows))<>n THEN RAISE EXCEPTION 'INVALID_SNAPSHOT_COUNT'; END IF;
 SELECT * INTO latest FROM public.house_gps_batches WHERE completed_at IS NOT NULL ORDER BY captured_at DESC,id DESC LIMIT 1;
 IF latest.source_name IS NOT NULL AND latest.source_name<>p_source THEN RAISE EXCEPTION 'SNAPSHOT_SOURCE_CHANGED'; END IF;
 IF latest.captured_at>p_captured THEN RAISE EXCEPTION 'SNAPSHOT_SUPERSEDED'; END IF;
 WITH incoming AS (SELECT * FROM jsonb_to_recordset(p_rows) x(house_id text,village_id text,moo text,address text,latitude text,longitude text)), existing AS (SELECT house_id,village_id,moo,address,latitude,longitude FROM public.house_gps_snapshot WHERE batch_id=latest.id)
 SELECT NOT EXISTS((SELECT * FROM incoming EXCEPT SELECT * FROM existing) UNION ALL (SELECT * FROM existing EXCEPT SELECT * FROM incoming)) INTO same;
 UPDATE public.house_gps_batches b SET evidence_pinned=true WHERE EXISTS(SELECT 1 FROM public.house_gps_queue q WHERE q.reference_captured_at=b.captured_at);
 IF latest.id IS NOT NULL AND same THEN
  target:=latest.id;state:='unchanged';
  UPDATE public.house_gps_batches SET captured_at=p_captured,source_name=p_source WHERE id=target;
 ELSE
  target:=p_id;state:='created';
  INSERT INTO public.house_gps_batches(id,captured_at,completed_at,source_name) VALUES(target,p_captured,now(),p_source);
  INSERT INTO public.house_gps_snapshot SELECT target,x.* FROM jsonb_to_recordset(p_rows) x(house_id text,village_id text,moo text,address text,latitude text,longitude text);
 END IF;
 -- Retain batches referenced by revision evidence. Never delete approval queues/receipts.
 DELETE FROM public.house_gps_snapshot s USING public.house_gps_batches b WHERE s.batch_id=b.id AND b.id<>target AND NOT b.evidence_pinned
 AND NOT EXISTS(SELECT 1 FROM public.house_gps_queue q WHERE q.reference_captured_at=b.captured_at)
 AND NOT EXISTS(SELECT 1 FROM public.house_gps_refresh_requests r WHERE r.result_batch_id=b.id AND r.state='processing');
 GET DIAGNOSTICS nr=ROW_COUNT;
 DELETE FROM public.house_gps_batches b WHERE b.id<>target AND NOT b.evidence_pinned AND NOT EXISTS(SELECT 1 FROM public.house_gps_snapshot s WHERE s.batch_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM public.house_gps_queue q WHERE q.reference_captured_at=b.captured_at)
 AND NOT EXISTS(SELECT 1 FROM public.house_gps_refresh_requests r WHERE r.result_batch_id=b.id AND r.state='processing');
 GET DIAGNOSTICS nb=ROW_COUNT;
 UPDATE public.house_gps_refresh_requests SET result_batch_id=target,house_count=n WHERE id=p_id AND house_gps_refresh_requests.state='processing';
 size_bytes:=pg_database_size(current_database());
 INSERT INTO public.house_gps_storage_daily VALUES((now() AT TIME ZONE 'Asia/Bangkok')::date,size_bytes,pg_total_relation_size('public.house_gps_snapshot'),size_bytes>=400000000,now())
 ON CONFLICT(day) DO UPDATE SET database_bytes=excluded.database_bytes,snapshot_bytes=excluded.snapshot_bytes,warning=excluded.warning,checked_at=excluded.checked_at;
 DELETE FROM public.house_gps_storage_daily WHERE day<(now() AT TIME ZONE 'Asia/Bangkok')::date-90;
 RETURN jsonb_build_object('status',state,'records',n,'deleted_rows',nr,'deleted_batches',nb,'database_bytes',size_bytes,'warning',size_bytes>=400000000);
END $$;

CREATE OR REPLACE FUNCTION public.house_gps_refresh_finish(p_id uuid,p_success boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.house_gps_refresh_requests;
BEGIN
 SELECT * INTO r FROM public.house_gps_refresh_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR r.state<>'processing' THEN RETURN; END IF;
 IF p_success IS NULL THEN RAISE EXCEPTION 'INVALID_RESULT'; END IF;
 IF p_success AND (r.result_batch_id IS NULL OR r.house_count IS NULL OR NOT EXISTS(SELECT 1 FROM public.house_gps_batches WHERE id=r.result_batch_id AND completed_at IS NOT NULL)) THEN RAISE EXCEPTION 'SNAPSHOT_INCOMPLETE'; END IF;
 UPDATE public.house_gps_refresh_requests SET state=CASE WHEN p_success THEN 'completed' ELSE 'failed' END,finished_at=now(),error_code=CASE WHEN p_success THEN NULL ELSE 'LAN_REFRESH_FAILED' END WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.house_gps_snapshot_publish(uuid,timestamptz,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.house_gps_snapshot_publish(uuid,timestamptz,jsonb,text) TO service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.house_gps_batches,public.house_gps_snapshot FROM service_role;
CREATE OR REPLACE FUNCTION public.house_gps_refresh_status() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a jsonb:=public.app_current_user(); r jsonb;b jsonb;
BEGIN
 IF a->>'userId' IS NULL OR coalesce(a->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT to_jsonb(t) INTO r FROM (SELECT id,state,requested_at,started_at,finished_at,house_count,error_code FROM public.house_gps_refresh_requests ORDER BY requested_at DESC,id DESC LIMIT 1)t;
 SELECT jsonb_build_object('captured_at',captured_at,'completed_at',completed_at) INTO b FROM public.house_gps_batches WHERE completed_at IS NOT NULL ORDER BY captured_at DESC,id DESC LIMIT 1;
 RETURN jsonb_build_object('request',r,'snapshot',b,'storage',(SELECT to_jsonb(d) FROM public.house_gps_storage_daily d ORDER BY day DESC LIMIT 1));
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
