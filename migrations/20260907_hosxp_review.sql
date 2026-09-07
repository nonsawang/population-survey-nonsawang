BEGIN;
CREATE TABLE IF NOT EXISTS public.hosxp_review_batches (
 id text PRIMARY KEY, source_name text NOT NULL, captured_at timestamptz NOT NULL,
 expected_count integer NOT NULL CHECK (expected_count >= 0), completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.hosxp_review_snapshot (
 batch_id text NOT NULL REFERENCES public.hosxp_review_batches(id),
 hosxp_person_id text NOT NULL, cid text, residency_type text, discharge_code text,
 source_updated_at text, PRIMARY KEY (batch_id, hosxp_person_id)
);
CREATE INDEX IF NOT EXISTS hosxp_review_snapshot_cid_idx ON public.hosxp_review_snapshot(batch_id, cid);
CREATE TABLE IF NOT EXISTS public.hosxp_review_sessions (
 token_hash text PRIMARY KEY, actor_id text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS public.hosxp_review_login_attempts (
 username text NOT NULL, attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hosxp_review_attempts_idx ON public.hosxp_review_login_attempts(username, attempted_at);
CREATE TABLE IF NOT EXISTS public.hosxp_review_approvals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), population_id text NOT NULL,
 target_person_id text NOT NULL, batch_id text NOT NULL REFERENCES public.hosxp_review_batches(id),
 fingerprint text NOT NULL, old_values jsonb NOT NULL, changes jsonb NOT NULL,
 approved_by text NOT NULL, approved_at timestamptz NOT NULL DEFAULT now(),
 state text NOT NULL DEFAULT 'approved' CHECK (state IN ('approved','cancelled','sent','failed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS hosxp_review_approval_unique ON public.hosxp_review_approvals(population_id, batch_id, fingerprint) WHERE state='approved';
ALTER TABLE public.hosxp_review_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosxp_review_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosxp_review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosxp_review_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosxp_review_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hosxp_review_batches, public.hosxp_review_snapshot, public.hosxp_review_sessions, public.hosxp_review_login_attempts, public.hosxp_review_approvals FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.hosxp_review_valid_cid(value text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE s integer := 0; i integer;
BEGIN
 IF value IS NULL OR value !~ '^[0-9]{13}$' THEN RETURN false; END IF;
 FOR i IN 1..12 LOOP s := s + substring(value,i,1)::integer * (14-i); END LOOP;
 RETURN ((11-(s%11))%10) = substring(value,13,1)::integer;
END $$;

CREATE OR REPLACE FUNCTION public.hosxp_review_actor(p_token text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor text;
BEGIN
 SELECT s.actor_id INTO actor FROM public.hosxp_review_sessions s
 JOIN public.app_users u ON u.id::text=s.actor_id
 WHERE s.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
 AND s.expires_at>now() AND u.is_active=true AND u.role IN ('staff','admin');
 IF actor IS NULL THEN RAISE EXCEPTION 'REVIEW_SESSION_EXPIRED'; END IF;
 RETURN actor;
END $$;

CREATE OR REPLACE FUNCTION public.hosxp_review_open_session(p_username text, p_password text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor text; token text; name text := lower(trim(p_username));
BEGIN
 IF p_password IS NULL OR length(p_password)>1024 OR name IS NULL OR length(name)>150 THEN
  RETURN jsonb_build_object('error','บัญชีหรือรหัสผ่านไม่ถูกต้อง');
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('hosxp-review-login:' || name));
 IF (SELECT count(*) FROM public.hosxp_review_login_attempts WHERE username=name AND attempted_at>now()-interval '15 minutes')>=10 THEN
  RETURN jsonb_build_object('error','ลองเข้าสู่ระบบหลายครั้ง กรุณารอ 15 นาที');
 END IF;
 SELECT id::text INTO actor FROM public.app_users
 WHERE lower(username)=name AND is_active=true AND role IN ('staff','admin')
 AND lower(password_hash)=encode(sha256(convert_to(p_password,'UTF8')),'hex');
 IF actor IS NULL THEN
  INSERT INTO public.hosxp_review_login_attempts(username) VALUES (name);
  RETURN jsonb_build_object('error','บัญชีหรือรหัสผ่านไม่ถูกต้อง หรือไม่มีสิทธิ์เจ้าหน้าที่');
 END IF;
 token := gen_random_uuid()::text || gen_random_uuid()::text;
 INSERT INTO public.hosxp_review_sessions VALUES (encode(sha256(convert_to(token,'UTF8')),'hex'),actor,now()+interval '30 minutes');
 RETURN jsonb_build_object('token',token,'expires_at',now()+interval '30 minutes');
END $$;

CREATE OR REPLACE VIEW public.hosxp_review_candidates AS
WITH latest AS (
 SELECT * FROM public.hosxp_review_batches WHERE completed_at IS NOT NULL ORDER BY captured_at DESC, id DESC LIMIT 1
), source_counts AS (
 SELECT trim(cid) cid, count(*) n FROM public.population GROUP BY trim(cid)
), target_counts AS (
 SELECT trim(s.cid) cid, count(*) n, min(s.hosxp_person_id) target_id
 FROM public.hosxp_review_snapshot s JOIN latest b ON b.id=s.batch_id GROUP BY trim(s.cid)
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
 LEFT JOIN public.hosxp_review_snapshot t ON t.batch_id=b.id AND t.hosxp_person_id=tc.target_id AND tc.n=1
 LEFT JOIN public.hosxp_review_snapshot idt ON idt.batch_id=b.id AND idt.hosxp_person_id=p.person_id
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
  SELECT * FROM filtered WHERE p_status='all' OR review_status=p_status
  ORDER BY moo,house,population_id LIMIT 25 OFFSET (greatest(1,least(coalesce(p_page,1),100000))-1)*25
 )
 SELECT jsonb_build_object(
  'total',(SELECT count(*) FROM filtered WHERE p_status='all' OR review_status=p_status),
  'counts',(SELECT coalesce(jsonb_object_agg(review_status,n),'{}'::jsonb) FROM (SELECT review_status,count(*) n FROM filtered GROUP BY review_status) v),
  'villages',(SELECT coalesce(jsonb_agg(moo ORDER BY moo),'[]'::jsonb) FROM (SELECT DISTINCT moo::text moo FROM public.population WHERE moo IS NOT NULL) m),
  'snapshot',(SELECT jsonb_build_object('id',id,'captured_at',captured_at,'source_name',source_name,'records',expected_count) FROM public.hosxp_review_batches WHERE completed_at IS NOT NULL ORDER BY captured_at DESC,id DESC LIMIT 1),
  'rows',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'population_id',population_id,'cid_masked',CASE WHEN length(cid)=13 THEN substring(cid,1,1)||'-XXXX-XXXXX-'||substring(cid,11,3) ELSE 'เลขบัตรไม่ถูกต้อง' END,
    'name',full_name,'moo',moo,'house',house,'target_id',target_id,'batch_id',batch_id,
    'old_type',old_type,'old_discharge',old_discharge,'new_type',new_type,'new_discharge',new_discharge,
    'changes',changes,'fingerprint',fingerprint,'status',review_status,'approved_at',approved_at
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
  SELECT * INTO candidate FROM public.hosxp_review_candidates WHERE population_id=item->>'population_id';
  IF NOT FOUND OR candidate.fingerprint IS DISTINCT FROM item->>'fingerprint' OR candidate.batch_id IS DISTINCT FROM item->>'batch_id' OR candidate.review_status NOT IN ('ready','approved') THEN
   RAISE EXCEPTION 'REVIEW_CHANGED_REFRESH';
  END IF;
  IF candidate.review_status='approved' THEN CONTINUE; END IF;
  UPDATE public.hosxp_review_approvals SET state='cancelled'
  WHERE population_id=candidate.population_id AND state='approved';
  INSERT INTO public.hosxp_review_approvals(population_id,target_person_id,batch_id,fingerprint,old_values,changes,approved_by)
  VALUES(candidate.population_id,candidate.target_id,candidate.batch_id,candidate.fingerprint,
   jsonb_build_object('house_regist_type_id',candidate.old_type,'person_discharge_id',candidate.old_discharge,'last_update',candidate.target_updated_at),candidate.changes,actor)
  ON CONFLICT (population_id,batch_id,fingerprint) WHERE state='approved' DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT; added:=added+n;
 END LOOP;
 RETURN jsonb_build_object('approved',added,'message','บันทึกการอนุมัติแล้ว ยังไม่ส่งเข้า HOSxP');
END $$;

REVOKE ALL ON FUNCTION public.hosxp_review_valid_cid(text), public.hosxp_review_actor(text), public.hosxp_review_open_session(text,text), public.hosxp_review_list(text,text,text,text,integer), public.hosxp_review_approve(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hosxp_review_open_session(text,text), public.hosxp_review_list(text,text,text,text,integer), public.hosxp_review_approve(text,jsonb) TO anon,authenticated;
GRANT ALL ON public.hosxp_review_batches,public.hosxp_review_snapshot TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
