BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.screening_normalize(v text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog AS $$
 SELECT lower(regexp_replace(translate(normalize(coalesce(v,''), NFKC),'๐๑๒๓๔๕๖๗๘๙'||chr(8203)||chr(8204)||chr(8205)||chr(65279),'0123456789'),'\s','','g'));
$$;
CREATE INDEX IF NOT EXISTS population_screening_name_trgm ON public.population
 USING gin (public.screening_normalize(coalesce(title,'')||coalesce(fname,'')||coalesce(lname,'')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS population_screening_cid_exact ON public.population
 (replace(public.screening_normalize(cid),'-',''));
CREATE INDEX IF NOT EXISTS population_screening_cid_trgm ON public.population
 USING gin (replace(public.screening_normalize(cid),'-','') extensions.gin_trgm_ops);

-- SECURITY INVOKER is intentional: the existing population RLS and session
-- header restrict every row, including counts, to the caller's village scope.
CREATE OR REPLACE FUNCTION public.screening_search(p_kpi text,p_query text,p_mode text DEFAULT 'auto',p_page integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE q text:=public.screening_normalize(p_query); digits text; numeric_query boolean;
 parts text[]; answer jsonb; today date:=(current_timestamp AT TIME ZONE 'Asia/Bangkok')::date;
BEGIN
 IF p_kpi IS NULL OR p_kpi NOT IN ('HEP','FOBT','HPV','CHILD') OR p_mode IS NULL OR p_mode NOT IN ('auto','name','cid','house')
 OR p_page IS NULL OR p_page<1 OR p_page>10000 OR length(coalesce(p_query,''))>100 THEN
 RAISE EXCEPTION 'INVALID_SEARCH' USING ERRCODE='22023'; END IF;
 numeric_query:=q ~ '^[0-9-]+$'; digits:=replace(q,'-','');
 IF q='' OR (p_mode NOT IN ('house','cid') AND length(q)<2)
 OR (p_mode='cid' AND (NOT numeric_query OR length(digits) NOT BETWEEN 4 AND 13))
 OR (p_mode='auto' AND numeric_query AND length(digits)>13) THEN
 RETURN jsonb_build_object('rows','[]'::jsonb,'total',0,'done',0); END IF;
 SELECT array_agg('%'||replace(replace(replace(public.screening_normalize(t),'\','\\'),'%','\%'),'_','\_')||'%') INTO parts
 FROM regexp_split_to_table(trim(p_query),'\s+') t WHERE public.screening_normalize(t)<>'';
 WITH matched AS MATERIALIZED (
 SELECT p.person_id,p.cid,p.title,p.fname,p.lname,p.birth_date,p.house,p.moo,
 CASE p_kpi WHEN 'HEP' THEN p.hep_screen WHEN 'FOBT' THEN p.fobt_screen WHEN 'HPV' THEN p.hpv_screen ELSE p.child_dev END AS screen_result,
 CASE p_kpi WHEN 'HEP' THEN p.hep_date WHEN 'FOBT' THEN p.fobt_date WHEN 'HPV' THEN p.hpv_date ELSE p.child_date END AS screen_date
 FROM public.population p
 WHERE trim(p.residency_type) IN ('1','3')
 AND (coalesce(p.status_model_version,0)<>1 OR p.person_discharge_id=9)
 AND CASE p_kpi
 WHEN 'HEP' THEN (CASE WHEN extract(year FROM p.birth_date)>2400 THEN extract(year FROM p.birth_date)-543 ELSE extract(year FROM p.birth_date) END)<1992
 WHEN 'FOBT' THEN extract(year FROM age(today,p.birth_date)) BETWEEN 50 AND 70
 WHEN 'HPV' THEN extract(year FROM age(today,p.birth_date)) BETWEEN 30 AND 60 AND trim(coalesce(p.title,'')) NOT IN ('นาย','ด.ช.','เด็กชาย','ด.ช')
 ELSE p.birth_date<=today AND extract(year FROM age(today,p.birth_date)) BETWEEN 0 AND 5 END
 AND (
 ((p_mode='name' OR (p_mode='auto' AND NOT numeric_query)) AND public.screening_normalize(coalesce(p.title,'')||coalesce(p.fname,'')||coalesce(p.lname,'')) LIKE parts[1] AND public.screening_normalize(coalesce(p.title,'')||coalesce(p.fname,'')||coalesce(p.lname,'')) LIKE ALL(parts))
 OR (p_mode IN ('cid','auto') AND numeric_query AND length(digits) BETWEEN 4 AND 13
 AND replace(public.screening_normalize(p.cid),'-','') ~ '^[0-9]{13}$'
 AND CASE WHEN length(digits)=13 THEN replace(public.screening_normalize(p.cid),'-','')=digits
 ELSE replace(public.screening_normalize(p.cid),'-','') LIKE '%'||digits||'%' END)
 OR ((p_mode='house' OR (p_mode='auto' AND ((numeric_query AND length(digits)<13) OR q ~ '^[0-9/]+$')))
 AND strpos(public.screening_normalize(p.house),q)>0)
 )), page_rows AS (
 SELECT * FROM matched ORDER BY (coalesce(screen_result,'') NOT IN ('','-','รอผล')),
 CASE WHEN moo ~ '^[0-9]+$' THEN moo::numeric END NULLS LAST,moo,person_id LIMIT 20 OFFSET (p_page-1)*20
 ) SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM page_rows r),'[]'::jsonb),
 'total',count(*),'done',count(*) FILTER (WHERE coalesce(screen_result,'') NOT IN ('','-','รอผล'))) INTO answer FROM matched;
 RETURN answer;
END $$;
REVOKE ALL ON FUNCTION public.screening_search(text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.screening_search(text,text,text,integer) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
