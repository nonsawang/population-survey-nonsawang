-- Explicit survey evidence. Does not write HOSxP or backfill confirmations.
BEGIN;
CREATE TABLE IF NOT EXISTS public.survey_person_reviews (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 person_id text NOT NULL REFERENCES public.population(person_id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES public.app_users(id),
 actor_name text NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 confirmed boolean NOT NULL,
 snapshot jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS survey_person_reviews_latest ON public.survey_person_reviews(person_id,id DESC);
ALTER TABLE public.survey_person_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.survey_person_reviews FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.survey_snapshot(p public.population) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('moo',p.moo,'house',p.house,'vhv',p.vhv,
 'relation',p.relation,'chronic',p.chronic,'residency_type',p.residency_type,
 'person_discharge_id',p.person_discharge_id,'status_model_version',p.status_model_version);
$$;
CREATE OR REPLACE FUNCTION app_private.survey_missing(p public.population) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
 SELECT array_remove(ARRAY[
 CASE WHEN coalesce(trim(p.relation),'') NOT IN ('เจ้าบ้าน','ผู้อาศัย','บิดา/มารดา','เขย/สะใภ้','บุตร/หลาน','เช่าอาศัย','อื่นๆ') THEN 'สถานะในบ้าน' END,
 CASE WHEN coalesce(trim(p.chronic),'') IN ('','-','ไม่ระบุ','ยังไม่ระบุ') THEN 'โรคประจำตัว หรือยืนยันว่าไม่มีโรค' END,
 CASE WHEN coalesce(p.residency_type,'') NOT IN ('0','1','2','3','4') OR p.status_model_version IS DISTINCT FROM 1 THEN 'ประเภทอยู่อาศัย' END,
 CASE WHEN coalesce(p.person_discharge_id,0) NOT IN (1,2,3,9) THEN 'สถานะจำหน่าย' END
 ],NULL);
$$;
CREATE OR REPLACE FUNCTION app_private.survey_scope(a jsonb,p public.population) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
 SELECT coalesce(a->>'role' IN ('admin','staff') OR (a->>'role'='vhv'
 AND trim(p.moo)=ANY(regexp_split_to_array(coalesce(a->>'moo',''),'\s*,\s*'))
 AND regexp_replace(trim(coalesce(p.vhv,'')),'\s+',' ','g')=regexp_replace(trim(coalesce(a->>'displayName','')),'\s+',' ','g')
 AND trim(coalesce(a->>'displayName',''))<>''),false);
$$;

CREATE OR REPLACE FUNCTION public.survey_confirm_person(p_person_id text,p_expected jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a jsonb:=public.app_current_user(); p public.population; r public.survey_person_reviews; s jsonb;
BEGIN
 SELECT * INTO p FROM public.population WHERE person_id=p_person_id FOR UPDATE;
 IF NOT FOUND OR NOT app_private.survey_scope(a,p) THEN RAISE EXCEPTION 'SURVEY_FORBIDDEN'; END IF;
 s:=app_private.survey_snapshot(p);
 IF p_expected IS DISTINCT FROM s THEN RAISE EXCEPTION 'SURVEY_CHANGED'; END IF;
 IF cardinality(app_private.survey_missing(p))>0 THEN RAISE EXCEPTION 'SURVEY_INCOMPLETE'; END IF;
 SELECT * INTO r FROM public.survey_person_reviews WHERE person_id=p_person_id ORDER BY id DESC LIMIT 1;
 IF NOT FOUND OR NOT r.confirmed OR r.snapshot IS DISTINCT FROM s THEN
  INSERT INTO public.survey_person_reviews(person_id,actor_id,actor_name,confirmed,snapshot)
  VALUES(p_person_id,(a->>'userId')::uuid,coalesce(a->>'displayName',a->>'username'),true,s) RETURNING * INTO r;
 END IF;
 RETURN jsonb_build_object('status','complete','reviewed_at',r.reviewed_at,'reviewed_by',r.actor_name);
END;
$$;

-- Edits through an authenticated survey account count as work started, not confirmation.
-- An import changing reviewed fields invalidates an older confirmation by snapshot mismatch.
CREATE OR REPLACE FUNCTION app_private.survey_record_edit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a jsonb:=public.app_current_user();
BEGIN
 IF app_private.survey_snapshot(NEW) IS DISTINCT FROM app_private.survey_snapshot(OLD)
 AND app_private.survey_scope(a,NEW) THEN
 INSERT INTO public.survey_person_reviews(person_id,actor_id,actor_name,confirmed,snapshot)
 VALUES(NEW.person_id,(a->>'userId')::uuid,coalesce(a->>'displayName',a->>'username'),false,app_private.survey_snapshot(NEW));
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS survey_record_edit ON public.population;
CREATE TRIGGER survey_record_edit AFTER UPDATE ON public.population FOR EACH ROW EXECUTE FUNCTION app_private.survey_record_edit();

CREATE OR REPLACE FUNCTION public.survey_progress_list(p_moo text DEFAULT NULL,p_house text DEFAULT NULL,p_after text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH actor AS (SELECT public.app_current_user() a), items AS (
 SELECT p.person_id,p.moo,p.house,p.vhv,p.title,p.fname,p.lname,p.latitude,p.longitude,
 p.residency_type,p.person_discharge_id,p.status_model_version,
 app_private.survey_snapshot(p) expected,app_private.survey_missing(p) missing,
 CASE WHEN r.id IS NULL THEN 'notStarted'
 WHEN r.confirmed AND r.snapshot=app_private.survey_snapshot(p) AND cardinality(app_private.survey_missing(p))=0 THEN 'complete'
 ELSE 'partial' END status,
 r.reviewed_at,r.actor_name reviewed_by
 FROM public.population p CROSS JOIN actor a
 LEFT JOIN LATERAL (SELECT * FROM public.survey_person_reviews WHERE person_id=p.person_id ORDER BY id DESC LIMIT 1) r ON true
 WHERE app_private.survey_scope(a.a,p)
 AND (p_moo IS NULL OR p.moo=p_moo) AND (p_house IS NULL OR p.house=p_house)
 AND (p_after IS NULL OR p.person_id>p_after)
 ORDER BY p.person_id LIMIT 500
 ) SELECT coalesce(jsonb_agg(to_jsonb(items) ORDER BY person_id),'[]'::jsonb) FROM items;
$$;
REVOKE ALL ON FUNCTION app_private.survey_snapshot(public.population),app_private.survey_missing(public.population),app_private.survey_scope(jsonb,public.population),app_private.survey_record_edit() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.survey_confirm_person(text,jsonb),public.survey_progress_list(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.survey_confirm_person(text,jsonb),public.survey_progress_list(text,text,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
