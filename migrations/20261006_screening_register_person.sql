BEGIN;
CREATE TABLE IF NOT EXISTS public.person_registration_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), person_id text NOT NULL UNIQUE,
 requested_by text NOT NULL, requested_at timestamptz NOT NULL DEFAULT now(),
 state text NOT NULL DEFAULT 'pending_registry_check' CHECK(state IN ('pending_registry_check','linked','requires_hosxp_registration','blocked')),
 error_code text
);
ALTER TABLE public.person_registration_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.person_registration_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.person_registration_requests TO service_role;
CREATE OR REPLACE FUNCTION public.screening_register_person(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor jsonb:=public.app_current_user(); v_cid text:=trim(p_data->>'cid'); existing text; new_id text; birthday date;
BEGIN
 IF coalesce(actor->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
 IF NOT coalesce(public.hosxp_review_valid_cid(v_cid),false) THEN RAISE EXCEPTION 'INVALID_CID'; END IF;
 IF coalesce(length(trim(p_data->>'fname')),0) NOT BETWEEN 1 AND 100 OR coalesce(length(trim(p_data->>'lname')),0) NOT BETWEEN 1 AND 100 OR coalesce(length(trim(p_data->>'house')),0) NOT BETWEEN 1 AND 100 OR coalesce(length(trim(p_data->>'vhv')),0) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'PERSON_FIELDS_REQUIRED'; END IF;
 birthday:=(p_data->>'birth_date')::date;
 IF birthday IS NULL OR birthday>current_date OR birthday<date '1900-01-01' THEN RAISE EXCEPTION 'INVALID_BIRTH_DATE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vhv_data WHERE moo::text=p_data->>'moo' AND name=p_data->>'vhv') THEN RAISE EXCEPTION 'INVALID_VILLAGE_VHV'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('register:'||v_cid,0));
 SELECT person_id INTO existing FROM public.population WHERE population.cid=v_cid LIMIT 1;
 IF existing IS NOT NULL THEN RETURN jsonb_build_object('status','existing','person_id',existing); END IF;
 new_id:='P-'||gen_random_uuid()::text;
 INSERT INTO public.population(person_id,cid,title,fname,lname,birth_date,house,moo,relation,residency_type,person_discharge_id,status_model_version,status,chronic,vhv,updated_at)
 VALUES(new_id,v_cid,trim(p_data->>'title'),trim(p_data->>'fname'),trim(p_data->>'lname'),birthday,trim(p_data->>'house'),p_data->>'moo','ผู้อาศัย','3','9',1,'Active','-',p_data->>'vhv',now());
 INSERT INTO public.person_registration_requests(person_id,requested_by) VALUES(new_id,coalesce(actor->>'userId',actor->>'username','staff'));
 RETURN jsonb_build_object('status','pending_registry_check','person_id',new_id);
END $$;
REVOKE ALL ON FUNCTION public.screening_register_person(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.screening_register_person(jsonb) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
