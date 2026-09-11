BEGIN;
CREATE TABLE public.screening_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), person_id text NOT NULL,
 kpi text NOT NULL CHECK(kpi IN ('HEP','FOBT','HPV','CHILD')),
 result text,screen_date date,previous_result text,previous_date date,
 recorded_by text,recorded_name text NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
 source text NOT NULL CHECK(source IN ('baseline','app','external'))
);
CREATE INDEX screening_history_person ON public.screening_history(person_id,kpi,recorded_at DESC,id);
CREATE TABLE public.screening_review (
 history_id uuid PRIMARY KEY REFERENCES public.screening_history(id),
 approved_by text NOT NULL,approved_name text NOT NULL,approved_at timestamptz NOT NULL DEFAULT now(),
 state text NOT NULL DEFAULT 'awaiting_mapping' CHECK(state='awaiting_mapping')
);
ALTER TABLE public.screening_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_review ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.screening_history,public.screening_review FROM anon,authenticated;
GRANT SELECT ON public.screening_history,public.screening_review TO anon,authenticated;
CREATE POLICY history_read ON public.screening_history FOR SELECT TO anon,authenticated USING (
 EXISTS(SELECT 1 FROM public.population p WHERE p.person_id=screening_history.person_id));
CREATE POLICY review_read ON public.screening_review FOR SELECT TO anon,authenticated USING (
 (SELECT public.app_current_user()->>'role') IN ('staff','admin'));

-- Snapshot existing latest values without inventing a historical recorder/date.
INSERT INTO public.screening_history(person_id,kpi,result,screen_date,recorded_name,source)
SELECT p.person_id,v.kpi,v.result,v.screen_date,'ไม่ทราบผู้บันทึกเดิม','baseline'
FROM public.population p CROSS JOIN LATERAL (VALUES
 ('HEP',p.hep_screen,p.hep_date),('FOBT',p.fobt_screen,p.fobt_date),
 ('HPV',p.hpv_screen,p.hpv_date),('CHILD',p.child_dev,p.child_date)) v(kpi,result,screen_date)
WHERE coalesce(v.result,'') NOT IN ('','-') OR v.screen_date IS NOT NULL;

CREATE FUNCTION public.capture_screening_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor jsonb:=public.app_current_user(); oldrow jsonb; newrow jsonb:=to_jsonb(NEW); k text; f text; d text;
BEGIN
 oldrow:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 FOR k,f,d IN SELECT * FROM (VALUES ('HEP','hep_screen','hep_date'),('FOBT','fobt_screen','fobt_date'),('HPV','hpv_screen','hpv_date'),('CHILD','child_dev','child_date')) v LOOP
 IF (newrow->>f,newrow->>d) IS DISTINCT FROM (oldrow->>f,oldrow->>d) THEN
   INSERT INTO public.screening_history(person_id,kpi,result,screen_date,previous_result,previous_date,recorded_by,recorded_name,source)
   VALUES(NEW.person_id,k,newrow->>f,(newrow->>d)::date,oldrow->>f,(oldrow->>d)::date,actor->>'userId',coalesce(actor->>'displayName','ระบบภายนอก'),CASE WHEN actor->>'userId' IS NULL THEN 'external' ELSE 'app' END);
 END IF; END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.capture_screening_history() FROM PUBLIC;
CREATE TRIGGER population_screening_history AFTER INSERT OR UPDATE OF hep_screen,hep_date,fobt_screen,fobt_date,hpv_screen,hpv_date,child_dev,child_date ON public.population
FOR EACH ROW EXECUTE FUNCTION public.capture_screening_history();

CREATE FUNCTION public.screening_history_list(p_person text,p_kpi text,p_page integer DEFAULT 1) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(h)),'[]'::jsonb) FROM
 (SELECT * FROM public.screening_history WHERE person_id=p_person AND kpi=p_kpi ORDER BY recorded_at DESC,id DESC LIMIT 20 OFFSET greatest(0,least(coalesce(p_page,1),10000)-1)*20) h;
$$;

CREATE FUNCTION public.screening_overview(p_kpi text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 WITH eligible AS (
 SELECT coalesce(nullif(trim(p.moo),''),'ไม่ระบุ') moo,coalesce(nullif(trim(p.vhv),''),'ยังไม่มอบหมาย') vhv,
 CASE p_kpi WHEN 'HEP' THEN p.hep_screen WHEN 'FOBT' THEN p.fobt_screen WHEN 'HPV' THEN p.hpv_screen ELSE p.child_dev END result
 FROM public.population p WHERE trim(p.residency_type) IN ('1','3') AND (coalesce(p.status_model_version,0)<>1 OR p.person_discharge_id=9)
 AND CASE p_kpi WHEN 'HEP' THEN (CASE WHEN extract(year FROM birth_date)>2400 THEN extract(year FROM birth_date)-543 ELSE extract(year FROM birth_date) END)<1992
 WHEN 'FOBT' THEN extract(year FROM age((current_timestamp AT TIME ZONE 'Asia/Bangkok')::date,birth_date)) BETWEEN 50 AND 70
 WHEN 'HPV' THEN extract(year FROM age((current_timestamp AT TIME ZONE 'Asia/Bangkok')::date,birth_date)) BETWEEN 30 AND 60 AND trim(coalesce(title,'')) NOT IN ('นาย','ด.ช.','เด็กชาย','ด.ช')
 WHEN 'CHILD' THEN birth_date<=(current_timestamp AT TIME ZONE 'Asia/Bangkok')::date AND extract(year FROM age((current_timestamp AT TIME ZONE 'Asia/Bangkok')::date,birth_date)) BETWEEN 0 AND 5 ELSE false END
 ), grouped AS (
 SELECT moo,vhv,count(*) total,count(*) FILTER(WHERE coalesce(result,'') NOT IN ('','-','รอผล')) done,
 count(*) FILTER(WHERE coalesce(result,'') IN ('','-','รอผล')) pending FROM eligible GROUP BY moo,vhv
 ) SELECT jsonb_build_object('groups',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY pending DESC,moo,vhv) FROM grouped g),'[]'::jsonb),'total',(SELECT count(*) FROM eligible));
$$;

-- Approval records a review of this immutable event. It does not enqueue a
-- demographic HOSxP update or claim that screening target mapping is known.
CREATE FUNCTION public.screening_review_approve(p_history uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor jsonb:=public.app_current_user(); h public.screening_history; p public.population;
BEGIN
 IF coalesce(actor->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
 SELECT * INTO h FROM public.screening_history WHERE id=p_history;
 IF NOT FOUND OR h.source='baseline' OR coalesce(h.result,'') IN ('','-','รอผล') OR h.screen_date IS NULL OR h.screen_date>(now() AT TIME ZONE 'Asia/Bangkok')::date THEN RAISE EXCEPTION 'INVALID_EVENT'; END IF;
 SELECT * INTO p FROM public.population WHERE person_id=h.person_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PERSON_NOT_FOUND'; END IF;
 INSERT INTO public.screening_review(history_id,approved_by,approved_name) VALUES(h.id,actor->>'userId',actor->>'displayName') ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('state','awaiting_mapping');
END $$;
CREATE FUNCTION public.screening_review_list(p_page integer DEFAULT 1) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE answer jsonb;
BEGIN
 IF coalesce(public.app_current_user()->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO answer FROM (
 SELECT h.*,coalesce(p.title,'')||coalesce(p.fname,'')||' '||coalesce(p.lname,'') person_name,p.moo,p.house,
 r.state,r.approved_name,r.approved_at
 FROM public.screening_history h JOIN public.population p ON p.person_id=h.person_id
 LEFT JOIN public.screening_review r ON r.history_id=h.id
 WHERE h.source<>'baseline' AND coalesce(h.result,'') NOT IN ('','-','รอผล')
 ORDER BY h.recorded_at DESC,h.id DESC LIMIT 20 OFFSET greatest(0,least(coalesce(p_page,1),10000)-1)*20) t;
 RETURN answer;
END $$;
REVOKE ALL ON FUNCTION public.screening_history_list(text,text,integer),public.screening_overview(text),public.screening_review_list(integer),public.screening_review_approve(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.screening_history_list(text,text,integer),public.screening_overview(text),public.screening_review_list(integer),public.screening_review_approve(uuid) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
