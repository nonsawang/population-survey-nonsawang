-- ============================================================================
-- สคริปต์กู้คืนพื้นที่ Supabase Cloud เมื่อติด 402 (DB Size Exceeded > 500 MB)
-- วิธีใช้: เปิด https://supabase.com/dashboard/project/gxidztlvqsppixlwrxeo/sql/new
-- แล้วรันแยกเป็น 3 ขั้นตอนตามลำดับด้านล่าง
-- ============================================================================

-- [ขั้นตอนที่ 1] ลบ Snapshot เก่าที่ซ้ำซ้อน (เก็บ Snapshot ล่าสุด + เก็บแถวที่มีประวัติอนุมัติครบ 100%)
-- ข้อมูลประชากร (population), คัดกรอง, ผู้ใช้งาน (app_users) จะไม่ถูกลบแม้แต่แถวเดียว
WITH latest_batch AS (
  SELECT id FROM public.hosxp_review_batches
  WHERE completed_at IS NOT NULL
  ORDER BY captured_at DESC, id DESC
  LIMIT 1
)
DELETE FROM public.hosxp_review_snapshot s
WHERE s.batch_id IS DISTINCT FROM (SELECT id FROM latest_batch)
  AND NOT EXISTS (
    SELECT 1 FROM public.hosxp_review_approvals a
    WHERE a.batch_id = s.batch_id
      AND a.target_person_id = s.hosxp_person_id
  );

WITH latest_batch AS (
  SELECT id FROM public.hosxp_review_batches
  WHERE completed_at IS NOT NULL
  ORDER BY captured_at DESC, id DESC
  LIMIT 1
)
DELETE FROM public.hosxp_review_batches b
WHERE b.id IS DISTINCT FROM (SELECT id FROM latest_batch)
  AND NOT EXISTS (
    SELECT 1 FROM public.hosxp_review_approvals a
    WHERE a.batch_id = b.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.hosxp_review_snapshot s
    WHERE s.batch_id = b.id
  );


-- ============================================================================
-- [ขั้นตอนที่ 2] คืนพื้นที่ดิสก์จริงให้ Supabase (ต้องก๊อปปี้เฉพาะบรรทัดนี้ไปกด Run แยกเดี่ยวๆ)
-- ============================================================================
VACUUM FULL public.hosxp_review_snapshot, public.hosxp_review_batches;


-- ============================================================================
-- [ขั้นตอนที่ 3] ตรวจสอบขนาดฐานข้อมูลหลังคืนพื้นที่ และปรับให้เก็บย้อนหลังแค่ 1 วัน (กันเต็มซ้ำ)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.hosxp_review_maintain() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE ids text[]; nr bigint; nb bigint; size_bytes bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('hosxp-review-refresh-v2'));
 LOCK TABLE public.hosxp_review_batches,public.hosxp_review_approvals,public.hosxp_review_snapshot IN SHARE ROW EXCLUSIVE MODE;
 SELECT array_agg(id) INTO ids FROM (
 SELECT b.id FROM public.hosxp_review_batches b
 WHERE b.captured_at < now() - interval '1 day'
 AND b.id IS DISTINCT FROM (SELECT id FROM public.hosxp_review_batches WHERE completed_at IS NOT NULL ORDER BY captured_at DESC,id DESC LIMIT 1)
 AND EXISTS (SELECT 1 FROM public.hosxp_review_batches WHERE completed_at IS NOT NULL)
 AND (EXISTS (SELECT 1 FROM public.hosxp_review_snapshot s WHERE s.batch_id=b.id AND NOT EXISTS (SELECT 1 FROM public.hosxp_review_approvals a WHERE a.batch_id=s.batch_id AND a.target_person_id=s.hosxp_person_id))
 OR NOT EXISTS (SELECT 1 FROM public.hosxp_review_approvals a WHERE a.batch_id=b.id))
 ORDER BY b.captured_at,b.id LIMIT 50) q;
 DELETE FROM public.hosxp_review_snapshot s WHERE s.batch_id=ANY(ids)
 AND NOT EXISTS (SELECT 1 FROM public.hosxp_review_approvals a WHERE a.batch_id=s.batch_id AND a.target_person_id=s.hosxp_person_id);
 GET DIAGNOSTICS nr=ROW_COUNT;
 DELETE FROM public.hosxp_review_batches b WHERE b.id=ANY(ids)
 AND NOT EXISTS (SELECT 1 FROM public.hosxp_review_approvals a WHERE a.batch_id=b.id);
 GET DIAGNOSTICS nb=ROW_COUNT;
 size_bytes:=pg_database_size(current_database());
 INSERT INTO public.hosxp_review_storage_daily VALUES((now() AT TIME ZONE 'Asia/Bangkok')::date,size_bytes,pg_total_relation_size('public.hosxp_review_snapshot'),now())
 ON CONFLICT(day) DO UPDATE SET database_bytes=excluded.database_bytes,snapshot_bytes=excluded.snapshot_bytes,checked_at=excluded.checked_at;
 DELETE FROM public.hosxp_review_storage_daily WHERE day<(now() AT TIME ZONE 'Asia/Bangkok')::date-90;
 RETURN jsonb_build_object('deleted_rows',nr,'deleted_batches',nb,'database_bytes',size_bytes,'warning',size_bytes>=400000000);
END $$;

SELECT pg_size_pretty(pg_database_size(current_database())) AS total_db_size,
       pg_size_pretty(pg_total_relation_size('public.hosxp_review_snapshot')) AS snapshot_size;
