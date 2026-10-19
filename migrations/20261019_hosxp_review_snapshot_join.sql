-- Restrict all matching to one complete snapshot; preserve classification and fingerprints.
BEGIN;
CREATE OR REPLACE VIEW public.hosxp_review_candidates AS
WITH latest AS MATERIALIZED (
 SELECT * FROM public.hosxp_review_batches WHERE completed_at IS NOT NULL ORDER BY captured_at DESC, id DESC LIMIT 1
), latest_snapshot AS MATERIALIZED (
 SELECT s.* FROM public.hosxp_review_snapshot s
 WHERE s.batch_id=(SELECT id FROM latest)
), source_counts AS (
 SELECT trim(cid) cid, count(*) n FROM public.population GROUP BY trim(cid)
), target_counts AS (
 SELECT trim(s.cid) cid, count(*) n, min(s.hosxp_person_id) target_id
 FROM latest_snapshot s GROUP BY trim(s.cid)
), joined AS (
 SELECT p.person_id AS population_id, trim(p.cid) cid,
 concat(coalesce(p.title,''),coalesce(p.fname,''),' ',coalesce(p.lname,'')) full_name,
 p.moo::text moo,p.house::text house,p.updated_at source_updated_at,
 trim(coalesce(p.residency_type::text,'')) new_type,p.person_discharge_id::text new_discharge,p.status_model_version,
 coalesce(sc.n,0) source_count,coalesce(tc.n,0) target_count,
 t.hosxp_person_id target_id,t.residency_type old_type,t.discharge_code old_discharge,t.source_updated_at target_updated_at,
 b.id batch_id,b.captured_at,
 (idt.hosxp_person_id IS NOT NULL AND trim(coalesce(idt.cid,'')) IS DISTINCT FROM trim(p.cid)) id_conflict
 FROM public.population p LEFT JOIN latest b ON true
 LEFT JOIN source_counts sc ON sc.cid=trim(p.cid)
 LEFT JOIN target_counts tc ON tc.cid=trim(p.cid)
 LEFT JOIN latest_snapshot t ON t.batch_id=b.id AND t.hosxp_person_id=tc.target_id AND tc.n=1
 LEFT JOIN latest_snapshot idt ON idt.batch_id=b.id AND idt.hosxp_person_id=p.person_id
), prepared AS (
 SELECT j.*,
 jsonb_strip_nulls(jsonb_build_object(
  'house_regist_type_id',CASE WHEN new_type IN ('0','1','2','3','4') AND new_type IS DISTINCT FROM old_type THEN new_type::integer END,
  'person_discharge_id',CASE WHEN new_discharge IN ('1','2','3','9') AND new_discharge IS DISTINCT FROM old_discharge THEN new_discharge::integer END
 )) changes,
 encode(sha256(convert_to(jsonb_build_array(population_id,cid,full_name,moo,house,source_updated_at,new_type,new_discharge,status_model_version,batch_id,target_id,old_type,old_discharge,target_updated_at)::text,'UTF8')),'hex') fingerprint
 FROM joined j
), classified AS (
 SELECT x.*,
 CASE WHEN batch_id IS NULL THEN 'no_snapshot'
 WHEN NOT public.hosxp_review_valid_cid(cid) THEN 'invalid_cid'
 WHEN source_count>1 OR target_count>1 THEN 'duplicate'
 WHEN id_conflict THEN 'id_conflict'
 WHEN target_id IS NULL THEN 'unmatched'
 WHEN status_model_version IS DISTINCT FROM 1 OR new_discharge IS NULL OR new_discharge NOT IN ('1','2','3','9') OR (new_type NOT IN ('0','1','2','3','4') AND NOT (new_type='' AND new_discharge='1')) THEN 'needs_review'
 WHEN captured_at<now()-interval '24 hours' THEN 'stale_snapshot'
 WHEN changes='{}'::jsonb THEN 'no_change'
 ELSE 'ready' END base_status
 FROM prepared x
)
SELECT c.*,a.id approval_id,a.approved_at,
 CASE WHEN base_status='ready' AND a.id IS NOT NULL THEN 'approved' ELSE base_status END review_status
FROM classified c LEFT JOIN public.hosxp_review_approvals a ON a.population_id=c.population_id AND a.batch_id=c.batch_id AND a.fingerprint=c.fingerprint AND a.state='approved';
REVOKE ALL ON public.hosxp_review_candidates FROM anon,authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
