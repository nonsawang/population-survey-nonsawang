-- Requires screening_register_person and hosxp_registry_link migrations.
BEGIN;
ALTER TABLE public.person_registration_requests ADD COLUMN IF NOT EXISTS checked_at timestamptz;
CREATE OR REPLACE FUNCTION public.screening_registration_ack(p_id uuid,p_snapshot jsonb,p_state text,p_code text,p_verified jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE request public.person_registration_requests%ROWTYPE; result jsonb;
BEGIN
 -- Same lock order as registry linking; registration and identity edits cannot race acknowledgement.
 LOCK TABLE public.population,public.person_identity_links,public.person_identity_jobs,public.person_identity_aliases IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO request FROM public.person_registration_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
 IF request.state='linked' THEN RETURN jsonb_build_object('state','linked'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.population p WHERE p.person_id=request.person_id AND p.person_id=p_snapshot->>'person_id' AND p.cid=p_snapshot->>'cid' AND p.birth_date::text=p_snapshot->>'birth_date') THEN RAISE EXCEPTION 'REGISTRATION_CHANGED'; END IF;
 IF p_state NOT IN ('linked','blocked','requires_hosxp_registration') OR p_state IS NULL THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 IF p_state='linked' THEN
  IF p_verified IS NULL OR p_verified->>'person_id' IS DISTINCT FROM request.person_id OR p_verified->>'cid' IS DISTINCT FROM p_snapshot->>'cid' OR p_verified->>'birth_date' IS DISTINCT FROM p_snapshot->>'birth_date' THEN RAISE EXCEPTION 'INVALID_VERIFICATION'; END IF;
  result:=public.hosxp_registry_link(jsonb_build_array(p_verified));
  IF coalesce((result->>'blocked')::int,1)>0 THEN p_state:='blocked';p_code:='IDENTITY_LINK_CONFLICT'; END IF;
 END IF;
 UPDATE public.person_registration_requests SET state=p_state,error_code=p_code,checked_at=now() WHERE id=p_id;
 RETURN jsonb_build_object('state',p_state);
END $$;
REVOKE ALL ON FUNCTION public.screening_registration_ack(uuid,jsonb,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.screening_registration_ack(uuid,jsonb,text,text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.screening_registration_status() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF coalesce(public.app_current_user()->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
 RETURN coalesce((SELECT jsonb_agg(row_to_json(r)) FROM (
  SELECT p.person_id,p.fname,p.lname,q.state,q.error_code,q.checked_at,q.requested_at
  FROM public.person_registration_requests q JOIN public.population p USING(person_id)
  ORDER BY q.requested_at DESC LIMIT 100
 ) r),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.screening_registration_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.screening_registration_status() TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
