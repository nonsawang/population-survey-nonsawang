-- Aggregate under the caller's RLS, including person identity restrictions.
BEGIN;
CREATE OR REPLACE FUNCTION public.dashboard_summary() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
WITH b AS MATERIALIZED (
 SELECT p.*,trim(coalesce(residency_type,'')) typ,trim(coalesce(moo,'')) m,trim(coalesce(house,'')) h,trim(coalesce(vhv,'')) v,
 CASE WHEN status_model_version=1 THEN person_discharge_id=9 ELSE trim(coalesce(residency_type,'')) NOT IN ('0','4') END a,
 CASE WHEN status_model_version=1 THEN person_discharge_id=1 ELSE trim(coalesce(residency_type,''))='4' END dead,
 extract(year from age((now() AT TIME ZONE 'Asia/Bangkok')::date,birth_date))::int age_years,
 CASE WHEN extract(year from birth_date)>2400 THEN extract(year from birth_date)-543 ELSE extract(year from birth_date) END byear,
 trim(coalesce(title,'')) IN ('นาย','ด.ช.','เด็กชาย','ด.ช') male,
 trim(coalesce(smoking_status,'')) sm,trim(coalesce(alcohol_status,'')) al,
 substring(trim(fagerstrom_score::text) from '^[+-]?[0-9]+')::numeric fs,
 substring(trim(assist_score::text) from '^[+-]?[0-9]+')::numeric als,
 (SELECT count(*) FROM regexp_split_to_table(trim(coalesce(chronic,'')),'[,/]+') d WHERE trim(d) NOT IN ('','ปกติ (ไม่มีโรค)') AND trim(coalesce(chronic,'')) NOT IN ('','-','ปกติ (ไม่มีโรค)')) chronic_n
 FROM public.population p
), f AS MATERIALIZED (
 SELECT person_id,m AS moo,h AS house,v AS vhv,typ,coalesce(a,false) active,coalesce(dead,false) deceased,
 CASE WHEN age_years BETWEEN 0 AND 150 THEN age_years END years,byear,male,sm,al,fs,als,chronic_n,hep_screen,fobt_screen,hpv_screen,child_dev FROM b
), grouped AS (
 SELECT moo,grouping(moo) overall,jsonb_build_object('total',count(*) FILTER(WHERE active AND typ<>'4'),
'discharged',count(*) FILTER(WHERE NOT active AND NOT deceased),
'deceased',count(*) FILTER(WHERE deceased),
'outside',count(*) FILTER(WHERE active AND typ='4'),
'unsurveyed',count(*) FILTER(WHERE active AND typ<>'4' AND typ NOT IN ('0','1','2','3')),
'type0',count(*) FILTER(WHERE active AND typ<>'4' AND typ='0'),
'type1',count(*) FILTER(WHERE active AND typ<>'4' AND typ='1'),
'type2',count(*) FILTER(WHERE active AND typ<>'4' AND typ='2'),
'type3',count(*) FILTER(WHERE active AND typ<>'4' AND typ='3'),
'type4',0,
'totalHouses',count(DISTINCT moo||'-'||house) FILTER(WHERE active AND typ<>'4' AND moo NOT IN ('','-')),
'chronicCount',coalesce(sum(chronic_n) FILTER(WHERE active AND typ<>'4'),0),
'population',jsonb_build_object('children',count(*) FILTER(WHERE active AND typ<>'4' AND years<15),
'working',count(*) FILTER(WHERE active AND typ<>'4' AND years BETWEEN 15 AND 59),
'elderly',count(*) FILTER(WHERE active AND typ<>'4' AND years>=60)),
'kpi',jsonb_build_object('hep',jsonb_build_object('total',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND byear<1992),
'screened',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND byear<1992 AND coalesce(hep_screen,'') NOT IN ('','-'))),
'fobt',jsonb_build_object('total',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years BETWEEN 50 AND 70),
'screened',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years BETWEEN 50 AND 70 AND coalesce(fobt_screen,'') NOT IN ('','-'))),
'hpv',jsonb_build_object('total',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND NOT male AND years BETWEEN 30 AND 60),
'screened',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND NOT male AND years BETWEEN 30 AND 60 AND coalesce(hpv_screen,'') NOT IN ('','-'))),
'child',jsonb_build_object('total',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years BETWEEN 0 AND 5),
'normal',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years BETWEEN 0 AND 5 AND coalesce(child_dev,'') NOT IN ('','-','รอผล')))),
'risk',jsonb_build_object('target15plus',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years>=15),
'smokeSurveyed',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years>=15 AND sm NOT IN ('','-')),
'alcSurveyed',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years>=15 AND al NOT IN ('','-')),
'smoking',jsonb_build_object('neverSmoked',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years>=15 AND position('ไม่สูบ ไม่เคย' in sm)>0),
'quit',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years>=15 AND NOT (position('ไม่สูบ ไม่เคย' in sm)>0) AND position('เลิกแล้ว' in sm)>0),
'current',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years>=15 AND sm='สูบ')),
'alcohol',jsonb_build_object('neverDrank',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years>=15 AND position('ไม่ดื่ม' in al)>0),
'quit',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years>=15 AND NOT (position('ไม่ดื่ม' in al)>0) AND position('หยุดแล้ว' in al)>0),
'current',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years>=15 AND al='ดื่ม')),
'fagerstrom',jsonb_build_object('low',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years>=15 AND sm='สูบ' AND fs<=3),
'medium',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years>=15 AND sm='สูบ' AND fs>3 AND fs<=6),
'high',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years>=15 AND sm='สูบ' AND fs>6)),
'assist',jsonb_build_object('low',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years>=15 AND al='ดื่ม' AND als<=10),
'medium',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years>=15 AND al='ดื่ม' AND als>10 AND als<=26),
'high',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3') AND years>=15 AND al='ดื่ม' AND als>26))),
'kpiGroup',count(*) FILTER(WHERE active AND typ<>'4' AND typ IN ('1','3'))) stats FROM f GROUP BY GROUPING SETS((),(moo))
), vhvs AS (
 SELECT vhv,count(*) people,count(DISTINCT moo||'-'||house) houses FROM f WHERE active AND typ<>'4' AND vhv NOT IN ('','-','ไม่ระบุ') GROUP BY vhv
), pyramid AS (
 SELECT n,count(*) FILTER(WHERE active AND typ<>'4' AND male AND years IS NOT NULL AND least(floor(years/5),16)=n) male,count(*) FILTER(WHERE active AND typ<>'4' AND NOT male AND years IS NOT NULL AND least(floor(years/5),16)=n) female FROM generate_series(0,16) n LEFT JOIN f ON true GROUP BY n
)
SELECT jsonb_build_object('summary',(SELECT stats FROM grouped WHERE overall=1),
 'groups',coalesce((SELECT jsonb_agg(jsonb_build_object('moo',moo,'stats',stats) ORDER BY CASE WHEN moo ~ '^[0-9]+$' THEN moo::numeric END,moo) FROM grouped WHERE overall=0),'[]'::jsonb),
 'pyramid',jsonb_build_object('labels','["0-4","5-9","10-14","15-19","20-24","25-29","30-34","35-39","40-44","45-49","50-54","55-59","60-64","65-69","70-74","75-79","80+"]'::jsonb,'male',(SELECT jsonb_agg(male ORDER BY n) FROM pyramid),'female',(SELECT jsonb_agg(female ORDER BY n) FROM pyramid)),
 'vhvList',coalesce((SELECT jsonb_agg(jsonb_build_object('name',vhv,'people',people,'houseCount',houses) ORDER BY people DESC,vhv) FROM vhvs),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.dashboard_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_summary() TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
