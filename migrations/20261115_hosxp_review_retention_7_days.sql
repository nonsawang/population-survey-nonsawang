BEGIN;
CREATE OR REPLACE FUNCTION public.hosxp_review_maintain() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE ids text[]; nr bigint; nb bigint; size_bytes bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('hosxp-review-refresh-v2'));
 LOCK TABLE public.hosxp_review_batches,public.hosxp_review_approvals,public.hosxp_review_snapshot IN SHARE ROW EXCLUSIVE MODE;
 SELECT array_agg(id) INTO ids FROM (
 SELECT b.id FROM public.hosxp_review_batches b
 WHERE b.captured_at<now()-interval '7 days'
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
NOTIFY pgrst,'reload schema';
COMMIT;
