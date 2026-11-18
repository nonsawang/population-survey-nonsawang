-- Zero-new-tables migration for [สำรวจบ้าน] (hosxp_review_approvals).
-- Adds 'processing' state, claimed_at, write_stamp, and error_code to existing hosxp_review_approvals table.
BEGIN;

ALTER TABLE public.hosxp_review_approvals
  DROP CONSTRAINT IF EXISTS hosxp_review_approvals_state_check;

ALTER TABLE public.hosxp_review_approvals
  ADD CONSTRAINT hosxp_review_approvals_state_check
  CHECK (state IN ('approved', 'processing', 'cancelled', 'sent', 'failed'));

ALTER TABLE public.hosxp_review_approvals
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS write_stamp text,
  ADD COLUMN IF NOT EXISTS error_code text;

DROP INDEX IF EXISTS public.hosxp_review_approval_unique;
CREATE UNIQUE INDEX hosxp_review_approval_unique
  ON public.hosxp_review_approvals(population_id, batch_id, fingerprint)
  WHERE state IN ('approved', 'processing');

GRANT SELECT, UPDATE ON public.hosxp_review_approvals TO service_role;

CREATE OR REPLACE VIEW public.hosxp_review_candidates AS
WITH latest AS MATERIALIZED (
  SELECT * FROM public.hosxp_review_batches WHERE completed_at IS NOT NULL ORDER BY captured_at DESC, id DESC LIMIT 1
), latest_snapshot AS MATERIALIZED (
  SELECT s.* FROM public.hosxp_review_snapshot s
  WHERE s.batch_id = (SELECT id FROM latest)
), source_counts AS (
  SELECT trim(cid) cid, count(*) n FROM public.population GROUP BY trim(cid)
), target_counts AS (
  SELECT trim(s.cid) cid, count(*) n, min(s.hosxp_person_id) target_id
  FROM latest_snapshot s GROUP BY trim(s.cid)
), joined AS (
  SELECT p.person_id AS population_id, trim(p.cid) cid,
  concat(coalesce(p.title,''),coalesce(p.fname,''),' ',coalesce(p.lname,'')) full_name,
  p.moo::text moo, p.house::text house, p.updated_at source_updated_at,
  trim(coalesce(p.residency_type::text,'')) new_type, p.person_discharge_id::text new_discharge, p.status_model_version,
  coalesce(sc.n,0) source_count, coalesce(tc.n,0) target_count,
  t.hosxp_person_id target_id, t.residency_type old_type, t.discharge_code old_discharge, t.source_updated_at target_updated_at,
  b.id batch_id, b.captured_at,
  (idt.hosxp_person_id IS NOT NULL AND trim(coalesce(idt.cid,'')) IS DISTINCT FROM trim(p.cid)) id_conflict
  FROM public.population p LEFT JOIN latest b ON true
  LEFT JOIN source_counts sc ON sc.cid = trim(p.cid)
  LEFT JOIN target_counts tc ON tc.cid = trim(p.cid)
  LEFT JOIN latest_snapshot t ON t.batch_id = b.id AND t.hosxp_person_id = tc.target_id AND tc.n = 1
  LEFT JOIN latest_snapshot idt ON idt.batch_id = b.id AND idt.hosxp_person_id = p.person_id
), prepared AS (
  SELECT j.*,
  jsonb_strip_nulls(jsonb_build_object(
    'house_regist_type_id', CASE WHEN new_type IN ('0','1','2','3','4') AND new_type IS DISTINCT FROM old_type THEN new_type::integer END,
    'person_discharge_id', CASE WHEN new_discharge IN ('1','2','3','9') AND new_discharge IS DISTINCT FROM old_discharge THEN new_discharge::integer END
  )) changes,
  encode(sha256(convert_to(jsonb_build_array(population_id,cid,full_name,moo,house,source_updated_at,new_type,new_discharge,status_model_version,batch_id,target_id,old_type,old_discharge,target_updated_at)::text,'UTF8')),'hex') fingerprint
  FROM joined j
), classified AS (
  SELECT x.*,
  CASE WHEN batch_id IS NULL THEN 'no_snapshot'
  WHEN NOT public.hosxp_review_valid_cid(cid) THEN 'invalid_cid'
  WHEN source_count > 1 OR target_count > 1 THEN 'duplicate'
  WHEN id_conflict THEN 'id_conflict'
  WHEN target_id IS NULL THEN 'unmatched'
  WHEN status_model_version IS DISTINCT FROM 1 OR new_discharge IS NULL OR new_discharge NOT IN ('1','2','3','9') OR (new_type NOT IN ('0','1','2','3','4') AND NOT (new_type = '' AND new_discharge = '1')) THEN 'needs_review'
  WHEN captured_at < now() - interval '24 hours' THEN 'stale_snapshot'
  WHEN changes = '{}'::jsonb THEN 'no_change'
  ELSE 'ready' END base_status
  FROM prepared x
)
SELECT c.*,
  a.id approval_id,
  coalesce(a.approved_at, last_a.approved_at) approved_at,
  CASE WHEN base_status = 'ready' AND a.id IS NOT NULL THEN 'approved' ELSE base_status END review_status,
  CASE
    WHEN last_a.state = 'sent' THEN 'sent'
    WHEN last_a.state = 'failed' THEN 'failed'
    WHEN base_status = 'ready' AND last_a.state = 'processing' THEN 'processing'
    WHEN base_status = 'ready' AND a.id IS NOT NULL THEN 'approved'
    ELSE base_status
  END display_status,
  last_a.error_code
FROM classified c
LEFT JOIN public.hosxp_review_approvals a
  ON a.population_id = c.population_id
  AND a.batch_id = c.batch_id
  AND a.fingerprint = c.fingerprint
  AND a.state = 'approved'
LEFT JOIN LATERAL (
  SELECT * FROM public.hosxp_review_approvals ap
  WHERE ap.population_id = c.population_id
    AND ap.batch_id = c.batch_id
    AND ap.fingerprint = c.fingerprint
    AND ap.state IN ('approved', 'processing', 'sent', 'failed')
  ORDER BY ap.approved_at DESC, ap.id DESC
  LIMIT 1
) last_a ON true;

REVOKE ALL ON public.hosxp_review_candidates FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.hosxp_review_list(p_token text,p_moo text DEFAULT '',p_search text DEFAULT '',p_status text DEFAULT 'ready',p_page integer DEFAULT 1) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.hosxp_review_actor(p_token);
 WITH filtered AS (
  SELECT * FROM public.hosxp_review_candidates
  WHERE (coalesce(p_moo,'')='' OR moo=p_moo)
  AND (coalesce(p_search,'')='' OR strpos(lower(full_name),lower(p_search))>0 OR strpos(coalesce(cid,''),p_search)>0 OR population_id=p_search OR target_id=p_search)
 ), page_rows AS (
  SELECT * FROM filtered WHERE p_status='all' OR display_status=p_status OR (p_status='approved' AND display_status='processing')
  ORDER BY moo,house,population_id LIMIT 25 OFFSET (greatest(1,least(coalesce(p_page,1),100000))-1)*25
 )
 SELECT jsonb_build_object(
  'total',(SELECT count(*) FROM filtered WHERE p_status='all' OR display_status=p_status OR (p_status='approved' AND display_status='processing')),
  'counts',(SELECT coalesce(jsonb_object_agg(display_status,n),'{}'::jsonb) FROM (SELECT display_status,count(*) n FROM filtered GROUP BY display_status) v),
  'villages',(SELECT coalesce(jsonb_agg(moo ORDER BY moo),'[]'::jsonb) FROM (SELECT DISTINCT moo::text moo FROM public.population WHERE moo IS NOT NULL) m),
  'snapshot',(SELECT jsonb_build_object('id',id,'captured_at',captured_at,'source_name',source_name,'records',expected_count) FROM public.hosxp_review_batches WHERE completed_at IS NOT NULL ORDER BY captured_at DESC,id DESC LIMIT 1),
  'rows',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'population_id',population_id,'cid_masked',CASE WHEN length(cid)=13 THEN substring(cid,1,1)||'-XXXX-XXXXX-'||substring(cid,11,3) ELSE 'เลขบัตรไม่ถูกต้อง' END,
    'name',full_name,'moo',moo,'house',house,'target_id',target_id,'batch_id',batch_id,
    'old_type',old_type,'old_discharge',old_discharge,'new_type',new_type,'new_discharge',new_discharge,
    'changes',changes,'fingerprint',fingerprint,'status',display_status,'approved_at',approved_at,'error_code',error_code
  ) ORDER BY moo,house,population_id),'[]'::jsonb) FROM page_rows)
 ) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.hosxp_review_approve(p_token text,p_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor text; item jsonb; candidate record; added integer := 0; n integer;
BEGIN
 actor := public.hosxp_review_actor(p_token);
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)<1 OR jsonb_array_length(p_items)>100 THEN RAISE EXCEPTION 'INVALID_SELECTION'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'population_id' LOOP
  PERFORM 1 FROM public.population WHERE person_id=item->>'population_id' FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.hosxp_review_approvals WHERE population_id=item->>'population_id' AND state='processing') THEN
   RAISE EXCEPTION 'REVIEW_CHANGED_REFRESH';
  END IF;
  SELECT * INTO candidate FROM public.hosxp_review_candidates WHERE population_id=item->>'population_id';
  IF NOT FOUND OR candidate.fingerprint IS DISTINCT FROM item->>'fingerprint' OR candidate.batch_id IS DISTINCT FROM item->>'batch_id' OR candidate.review_status NOT IN ('ready','approved') THEN
   RAISE EXCEPTION 'REVIEW_CHANGED_REFRESH';
  END IF;
  IF candidate.review_status='approved' THEN CONTINUE; END IF;
  UPDATE public.hosxp_review_approvals SET state='cancelled', error_code='SUPERSEDED_BY_NEW_APPROVAL'
  WHERE population_id=candidate.population_id AND state='approved';
  INSERT INTO public.hosxp_review_approvals(population_id,target_person_id,batch_id,fingerprint,old_values,changes,approved_by)
  VALUES(candidate.population_id,candidate.target_id,candidate.batch_id,candidate.fingerprint,
   jsonb_build_object('house_regist_type_id',candidate.old_type,'person_discharge_id',candidate.old_discharge,'last_update',candidate.target_updated_at),candidate.changes,actor)
  ON CONFLICT (population_id,batch_id,fingerprint) WHERE state IN ('approved', 'processing') DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT; added:=added+n;
 END LOOP;
 RETURN jsonb_build_object('approved',added,'message','บันทึกการอนุมัติแล้ว ยังไม่ส่งเข้า HOSxP');
END $$;

-- Atomically claim an approved item, transitioning state to 'processing' and recording write_stamp
CREATE OR REPLACE FUNCTION public.hosxp_review_claim(p_id uuid, p_write_stamp text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE a public.hosxp_review_approvals%ROWTYPE; c record; v_stamp text;
BEGIN
  SELECT * INTO a FROM public.hosxp_review_approvals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR a.state <> 'approved' THEN RAISE EXCEPTION 'NOT_APPROVED'; END IF;
  PERFORM 1 FROM public.population WHERE person_id = a.population_id FOR UPDATE;
  SELECT * INTO c FROM public.hosxp_review_candidates WHERE population_id = a.population_id;
  IF NOT FOUND OR c.review_status <> 'approved' OR c.approval_id IS DISTINCT FROM a.id
     OR c.fingerprint IS DISTINCT FROM a.fingerprint OR c.target_id IS DISTINCT FROM a.target_person_id
  THEN RAISE EXCEPTION 'REVIEW_CHANGED_REFRESH'; END IF;

  IF p_write_stamp IS NOT NULL AND p_write_stamp ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$' THEN
    v_stamp := p_write_stamp;
  ELSE
    v_stamp := to_char(clock_timestamp() AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS');
  END IF;

  -- Ensure write_stamp is always distinct from old_values.last_update so reconciliation can distinguish pre/post write
  IF v_stamp = coalesce(a.old_values->>'last_update', '') THEN
    v_stamp := to_char((v_stamp::timestamp + interval '1 second'), 'YYYY-MM-DD HH24:MI:SS');
  END IF;

  UPDATE public.hosxp_review_approvals
  SET state = 'processing', claimed_at = now(), write_stamp = v_stamp, error_code = NULL
  WHERE id = p_id
  RETURNING * INTO a;

  RETURN to_jsonb(a) || jsonb_build_object('cid', c.cid);
END $$;

-- Complete or reconcile an item in hosxp_review_approvals
CREATE OR REPLACE FUNCTION public.hosxp_review_complete(p_id uuid, p_outcome text, p_error_code text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE a public.hosxp_review_approvals%ROWTYPE;
BEGIN
  IF p_outcome NOT IN ('sent', 'failed', 'cancelled', 'approved') THEN RAISE EXCEPTION 'INVALID_OUTCOME'; END IF;
  SELECT * INTO a FROM public.hosxp_review_approvals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF a.state = p_outcome THEN RETURN; END IF;
  IF a.state IN ('sent', 'failed', 'cancelled') THEN RAISE EXCEPTION 'OUTCOME_CONFLICT'; END IF;

  IF p_outcome = 'approved' THEN
    IF a.state <> 'processing' THEN RAISE EXCEPTION 'OUTCOME_CONFLICT'; END IF;
    UPDATE public.hosxp_review_approvals
    SET state = 'approved', claimed_at = NULL, write_stamp = NULL, error_code = p_error_code
    WHERE id = p_id;
    RETURN;
  END IF;

  UPDATE public.hosxp_review_approvals
  SET state = p_outcome,
      error_code = CASE WHEN p_outcome = 'sent' THEN NULL ELSE p_error_code END
  WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public.hosxp_review_claim(uuid, text), public.hosxp_review_complete(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hosxp_review_claim(uuid, text), public.hosxp_review_complete(uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
