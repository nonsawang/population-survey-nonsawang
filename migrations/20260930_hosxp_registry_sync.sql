BEGIN;
CREATE TABLE public.hosxp_registry_sync_state(id boolean PRIMARY KEY DEFAULT true CHECK(id),last_success_at timestamptz,updated_count integer NOT NULL DEFAULT 0,blocked_count integer NOT NULL DEFAULT 0);
CREATE TABLE public.hosxp_registry_name_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,person_id text NOT NULL,old_name jsonb NOT NULL,new_name jsonb NOT NULL,changed_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.hosxp_registry_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosxp_registry_name_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hosxp_registry_sync_state,public.hosxp_registry_name_audit FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.hosxp_registry_apply(p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r jsonb; l public.person_identity_links%ROWTYPE; p public.population%ROWTYPE; n integer:=0; b integer:=0;
BEGIN
 IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>500 THEN RAISE EXCEPTION 'SYNC_INVALID_BATCH'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('hosxp-registry-sync'));
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  SELECT * INTO l FROM public.person_identity_links WHERE person_id=r->>'person_id' FOR UPDATE;
  SELECT * INTO p FROM public.population WHERE person_id=r->>'person_id' FOR UPDATE;
  IF l.person_id IS NULL OR p.person_id IS NULL OR l.cid IS DISTINCT FROM r->>'cid' OR p.cid IS DISTINCT FROM l.cid
   OR l.hn IS DISTINCT FROM r->>'hn' OR l.hosxp_person_id IS DISTINCT FROM r->>'hosxp_person_id'
   OR p.birth_date::text IS DISTINCT FROM r->>'birth_date'
   OR EXISTS(SELECT 1 FROM public.population x WHERE x.cid=l.cid AND x.person_id<>p.person_id)
   OR EXISTS(SELECT 1 FROM public.person_identity_aliases WHERE person_id=p.person_id)
   OR EXISTS(SELECT 1 FROM public.person_identity_jobs WHERE state IN ('pending','applying') AND (source_id=p.person_id OR target_id=p.person_id))
   OR coalesce(trim(r->>'fname'),'')='' OR coalesce(trim(r->>'lname'),'')='' THEN b:=b+1; CONTINUE; END IF;
  IF (p.fname,p.lname) IS DISTINCT FROM (r->>'fname',r->>'lname') THEN
   INSERT INTO public.hosxp_registry_name_audit(person_id,old_name,new_name) VALUES(p.person_id,jsonb_build_object('fname',p.fname,'lname',p.lname),jsonb_build_object('fname',r->>'fname','lname',r->>'lname'));
   UPDATE public.population SET fname=r->>'fname',lname=r->>'lname' WHERE person_id=p.person_id;
   n:=n+1;
  END IF;
 END LOOP;
 INSERT INTO public.hosxp_registry_sync_state(id,last_success_at,updated_count,blocked_count) VALUES(true,now(),n,b)
 ON CONFLICT(id) DO UPDATE SET last_success_at=excluded.last_success_at,updated_count=excluded.updated_count,blocked_count=excluded.blocked_count;
 RETURN jsonb_build_object('updated',n,'blocked',b);
END $$;
REVOKE ALL ON FUNCTION public.hosxp_registry_apply(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hosxp_registry_apply(jsonb) TO service_role;
CREATE FUNCTION public.hosxp_registry_status() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF coalesce(public.app_current_user()->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
 RETURN jsonb_build_object('sync',(SELECT to_jsonb(s)-'id' FROM public.hosxp_registry_sync_state s WHERE id=true),'linked',(SELECT count(*) FROM public.person_identity_links),'snapshot_at',(SELECT max(captured_at) FROM public.hosxp_review_batches WHERE completed_at IS NOT NULL));
END $$;
REVOKE ALL ON FUNCTION public.hosxp_registry_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hosxp_registry_status() TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
