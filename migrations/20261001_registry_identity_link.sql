-- Requires 20260925_person_identity.sql. Links only; never merges people.
BEGIN;
ALTER TABLE public.person_identity_links ALTER COLUMN job_id DROP NOT NULL;
ALTER TABLE public.person_identity_links ADD COLUMN link_source text NOT NULL DEFAULT 'reviewed_merge' CHECK(link_source IN ('reviewed_merge','registry_verified'));
CREATE TABLE public.registry_link_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,person_id text NOT NULL,cid text NOT NULL,hn text NOT NULL,hosxp_person_id text NOT NULL,birth_date date NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.registry_link_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registry_link_audit FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.hosxp_registry_link(p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r jsonb; p public.population%ROWTYPE; l public.person_identity_links%ROWTYPE; linked integer:=0; existing integer:=0; blocked integer:=0;
BEGIN
 IF p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>100 THEN RAISE EXCEPTION 'LINK_INVALID_BATCH'; END IF;
 -- Prevent a concurrent duplicate, demographic edit or identity merge between validation and insert.
 LOCK TABLE public.population,public.person_identity_links,public.person_identity_jobs,public.person_identity_aliases IN SHARE ROW EXCLUSIVE MODE;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  SELECT * INTO p FROM public.population WHERE person_id=r->>'person_id';
  IF p.person_id IS NULL OR NOT public.hosxp_review_valid_cid(r->>'cid') OR p.cid IS DISTINCT FROM r->>'cid'
   OR p.birth_date IS NULL OR p.birth_date::text IS DISTINCT FROM r->>'birth_date'
   OR coalesce(trim(r->>'hn'),'')='' OR coalesce(r->>'hosxp_person_id','') !~ '^[0-9]+$'
   OR EXISTS(SELECT 1 FROM public.population WHERE cid=p.cid AND person_id<>p.person_id)
   OR EXISTS(SELECT 1 FROM public.person_identity_aliases WHERE person_id=p.person_id)
   OR EXISTS(SELECT 1 FROM public.person_identity_jobs WHERE state IN ('pending','applying') AND (source_id=p.person_id OR target_id=p.person_id)) THEN blocked:=blocked+1; CONTINUE; END IF;
  SELECT * INTO l FROM public.person_identity_links WHERE person_id=p.person_id;
  IF l.person_id IS NOT NULL THEN
   IF (l.cid,l.hn,l.hosxp_person_id) IS NOT DISTINCT FROM (r->>'cid',r->>'hn',r->>'hosxp_person_id') THEN existing:=existing+1; ELSE blocked:=blocked+1; END IF;
   CONTINUE;
  END IF;
  IF EXISTS(SELECT 1 FROM public.person_identity_links WHERE cid=r->>'cid' OR hn=r->>'hn' OR hosxp_person_id=r->>'hosxp_person_id') THEN blocked:=blocked+1; CONTINUE; END IF;
  INSERT INTO public.person_identity_links(person_id,hosxp_person_id,hn,cid,verified_at,job_id,link_source) VALUES(p.person_id,r->>'hosxp_person_id',r->>'hn',r->>'cid',now(),NULL,'registry_verified');
  INSERT INTO public.registry_link_audit(person_id,cid,hn,hosxp_person_id,birth_date) VALUES(p.person_id,p.cid,r->>'hn',r->>'hosxp_person_id',p.birth_date);
  linked:=linked+1;
 END LOOP;
 RETURN jsonb_build_object('linked',linked,'existing',existing,'blocked',blocked);
END $$;
REVOKE ALL ON FUNCTION public.hosxp_registry_link(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hosxp_registry_link(jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
