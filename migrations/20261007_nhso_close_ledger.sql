-- Preparation only: no real API sender is enabled by this migration.
BEGIN;
CREATE TABLE public.nhso_close_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 zone text NOT NULL CHECK (zone IN ('test','production')),
 hcode text NOT NULL CHECK (hcode ~ '^[0-9]{5}$'),
 visit_number text NOT NULL CHECK (length(visit_number) BETWEEN 1 AND 100),
 service_code text NOT NULL CHECK (length(service_code) BETWEEN 1 AND 100),
 request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
 transaction_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','outcome_unknown','confirmed')),
 seq text,
 authen_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(zone,hcode,visit_number,service_code),
 CHECK (state <> 'confirmed' OR (length(seq)>0 AND seq IS NOT NULL AND length(authen_code)>0 AND authen_code IS NOT NULL))
);
ALTER TABLE public.nhso_close_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nhso_close_submissions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nhso_close_submissions TO service_role;

CREATE FUNCTION public.nhso_close_reserve(p_zone text,p_hcode text,p_visit text,p_service text,p_hash text,p_owner uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.nhso_close_submissions%ROWTYPE; inserted boolean;
BEGIN
 -- Live production activation requires a separately reviewed change.
 IF p_zone IS DISTINCT FROM 'test' THEN RAISE EXCEPTION 'CLOSE_PRODUCTION_DISABLED'; END IF;
 INSERT INTO public.nhso_close_submissions(zone,hcode,visit_number,service_code,request_hash,owner_id)
 VALUES(p_zone,p_hcode,p_visit,p_service,p_hash,p_owner)
 ON CONFLICT(zone,hcode,visit_number,service_code) DO NOTHING RETURNING * INTO r;
 inserted:=FOUND;
 IF NOT inserted THEN
  SELECT * INTO r FROM public.nhso_close_submissions
  WHERE zone=p_zone AND hcode=p_hcode AND visit_number=p_visit AND service_code=p_service FOR UPDATE;
  IF r.request_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'CLOSE_PAYLOAD_CHANGED'; END IF;
 END IF;
 -- Even the same owner cannot reserve a second sending attempt after a lost response.
 RETURN jsonb_build_object('id',r.id,'transactionId',r.transaction_id,'state',r.state,'acquired',inserted);
END $$;

CREATE FUNCTION public.nhso_close_record(p_id uuid,p_owner uuid,p_state text,p_seq text DEFAULT NULL,p_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.nhso_close_submissions%ROWTYPE;
BEGIN
 IF p_state IS NULL OR p_state NOT IN ('outcome_unknown','confirmed') THEN RAISE EXCEPTION 'CLOSE_INVALID_STATE'; END IF;
 SELECT * INTO r FROM public.nhso_close_submissions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOSE_NOT_FOUND'; END IF;
 IF r.owner_id IS DISTINCT FROM p_owner THEN RAISE EXCEPTION 'CLOSE_OWNER_MISMATCH'; END IF;
 IF p_state='confirmed' AND (p_seq IS NULL OR length(trim(p_seq)) NOT BETWEEN 1 AND 100 OR p_code IS NULL OR length(trim(p_code)) NOT BETWEEN 1 AND 100) THEN RAISE EXCEPTION 'CLOSE_INVALID_RESULT'; END IF;
 IF r.state='confirmed' THEN
  IF p_state<>'confirmed' OR r.seq IS DISTINCT FROM p_seq OR r.authen_code IS DISTINCT FROM p_code THEN RAISE EXCEPTION 'CLOSE_RESULT_CONFLICT'; END IF;
 ELSE
  UPDATE public.nhso_close_submissions SET state=p_state,
   seq=CASE WHEN p_state='confirmed' THEN p_seq ELSE NULL END,
   authen_code=CASE WHEN p_state='confirmed' THEN p_code ELSE NULL END,updated_at=now() WHERE id=p_id;
 END IF;
 RETURN jsonb_build_object('id',p_id,'state',p_state);
END $$;
REVOKE ALL ON FUNCTION public.nhso_close_reserve(text,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.nhso_close_record(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nhso_close_reserve(text,text,text,text,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.nhso_close_record(uuid,uuid,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
