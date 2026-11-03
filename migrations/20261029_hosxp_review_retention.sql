BEGIN;
ALTER TABLE public.hosxp_review_batches ADD COLUMN IF NOT EXISTS first_captured_at timestamptz;
UPDATE public.hosxp_review_batches SET first_captured_at=captured_at WHERE first_captured_at IS NULL;
-- Retain the exact target row as evidence, even after unrelated rows are pruned.
ALTER TABLE public.hosxp_review_approvals ADD CONSTRAINT hosxp_review_approval_evidence_fk
 FOREIGN KEY(batch_id,target_person_id) REFERENCES public.hosxp_review_snapshot(batch_id,hosxp_person_id);
CREATE TABLE public.hosxp_review_storage_daily(day date PRIMARY KEY,database_bytes bigint NOT NULL,snapshot_bytes bigint NOT NULL,checked_at timestamptz NOT NULL);
ALTER TABLE public.hosxp_review_storage_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hosxp_review_storage_daily FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.hosxp_review_storage_daily TO service_role;
CREATE OR REPLACE FUNCTION public.hosxp_review_maintain() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE ids text[]; nr bigint; nb bigint; size_bytes bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('hosxp-review-refresh-v2'));
 LOCK TABLE public.hosxp_review_batches,public.hosxp_review_approvals,public.hosxp_review_snapshot IN SHARE ROW EXCLUSIVE MODE;
 SELECT array_agg(id) INTO ids FROM (
 SELECT b.id FROM public.hosxp_review_batches b
 WHERE b.captured_at<now()-interval '1 day'
 AND b.id IS DISTINCT FROM(SELECT id FROM public.hosxp_review_batches WHERE completed_at IS NOT NULL ORDER BY captured_at DESC,id DESC LIMIT 1)
 AND EXISTS(SELECT 1 FROM public.hosxp_review_batches WHERE completed_at IS NOT NULL)
 AND (EXISTS(SELECT 1 FROM public.hosxp_review_snapshot s WHERE s.batch_id=b.id AND NOT EXISTS(SELECT 1 FROM public.hosxp_review_approvals a WHERE a.batch_id=s.batch_id AND a.target_person_id=s.hosxp_person_id))
 OR NOT EXISTS(SELECT 1 FROM public.hosxp_review_approvals a WHERE a.batch_id=b.id))
 ORDER BY b.captured_at,b.id LIMIT 50) q;
 DELETE FROM public.hosxp_review_snapshot s WHERE s.batch_id=ANY(ids)
 AND NOT EXISTS(SELECT 1 FROM public.hosxp_review_approvals a WHERE a.batch_id=s.batch_id AND a.target_person_id=s.hosxp_person_id);
 GET DIAGNOSTICS nr=ROW_COUNT;
 DELETE FROM public.hosxp_review_batches b WHERE b.id=ANY(ids)
 AND NOT EXISTS(SELECT 1 FROM public.hosxp_review_approvals a WHERE a.batch_id=b.id);
 GET DIAGNOSTICS nb=ROW_COUNT;
 size_bytes:=pg_database_size(current_database());
 INSERT INTO public.hosxp_review_storage_daily VALUES((now() AT TIME ZONE 'Asia/Bangkok')::date,size_bytes,pg_total_relation_size('public.hosxp_review_snapshot'),now())
 ON CONFLICT(day) DO UPDATE SET database_bytes=excluded.database_bytes,snapshot_bytes=excluded.snapshot_bytes,checked_at=excluded.checked_at;
 DELETE FROM public.hosxp_review_storage_daily WHERE day<(now() AT TIME ZONE 'Asia/Bangkok')::date-90;
 RETURN jsonb_build_object('deleted_rows',nr,'deleted_batches',nb,'database_bytes',size_bytes,'warning',size_bytes>=400000000);
END $$;
CREATE FUNCTION public.hosxp_review_refresh_v2(p_source text,p_captured timestamptz,p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE latest public.hosxp_review_batches%ROWTYPE; new_id text; n integer; same boolean;
BEGIN
 IF NOT pg_try_advisory_xact_lock(hashtext('hosxp-review-refresh-v2')) THEN RETURN jsonb_build_object('status','busy'); END IF;
 IF p_source IS NULL OR length(p_source)=0 OR p_captured IS NULL OR p_captured>now()+interval '5 minutes' OR p_captured<now()-interval '1 hour'
 OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_SNAPSHOT'; END IF;
 n:=jsonb_array_length(p_rows);
 IF n<1 OR n>100000 THEN RAISE EXCEPTION 'INVALID_SNAPSHOT_COUNT'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(p_rows) x(hosxp_person_id text) WHERE hosxp_person_id IS NULL OR hosxp_person_id='')
 OR (SELECT count(DISTINCT hosxp_person_id) FROM jsonb_to_recordset(p_rows) x(hosxp_person_id text))<>n THEN RAISE EXCEPTION 'DUPLICATE_OR_MISSING_PERSON'; END IF;
 SELECT * INTO latest FROM public.hosxp_review_batches WHERE completed_at IS NOT NULL ORDER BY captured_at DESC,id DESC LIMIT 1;
 IF latest.id IS NOT NULL AND latest.source_name<>p_source THEN RAISE EXCEPTION 'SNAPSHOT_SOURCE_CHANGED'; END IF;
 IF latest.id IS NOT NULL AND p_captured<latest.captured_at THEN RETURN jsonb_build_object('status','superseded'); END IF;
 WITH incoming AS (SELECT * FROM jsonb_to_recordset(p_rows) x(hosxp_person_id text,cid text,residency_type text,discharge_code text,source_updated_at text)),
 existing AS (SELECT hosxp_person_id,cid,residency_type,discharge_code,source_updated_at FROM public.hosxp_review_snapshot WHERE batch_id=latest.id)
 SELECT NOT EXISTS((SELECT * FROM incoming EXCEPT SELECT * FROM existing) UNION ALL (SELECT * FROM existing EXCEPT SELECT * FROM incoming)) INTO same;
 IF latest.id IS NOT NULL AND same THEN
 UPDATE public.hosxp_review_batches SET captured_at=p_captured WHERE id=latest.id;
 RETURN jsonb_build_object('status','unchanged','records',n);
 END IF;
 new_id:=gen_random_uuid()::text;
 INSERT INTO public.hosxp_review_batches(id,source_name,captured_at,first_captured_at,expected_count,completed_at) VALUES(new_id,p_source,p_captured,p_captured,n,now());
 INSERT INTO public.hosxp_review_snapshot SELECT new_id,x.* FROM jsonb_to_recordset(p_rows) x(hosxp_person_id text,cid text,residency_type text,discharge_code text,source_updated_at text);
 RETURN jsonb_build_object('status','created','records',n);
END $$;
REVOKE ALL ON FUNCTION public.hosxp_review_refresh_v2(text,timestamptz,jsonb),public.hosxp_review_maintain() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hosxp_review_refresh_v2(text,timestamptz,jsonb),public.hosxp_review_maintain() TO service_role;
-- Fence old uploaders: all mutations must use serialized RPCs.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.hosxp_review_batches,public.hosxp_review_snapshot FROM service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
