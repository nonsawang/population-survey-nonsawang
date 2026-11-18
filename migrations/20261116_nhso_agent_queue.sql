BEGIN;
ALTER TABLE public.fit_close_intents ADD COLUMN transport text NOT NULL DEFAULT 'direct' CHECK(transport IN ('direct','agent'));
CREATE TABLE public.nhso_agent_stations(id text PRIMARY KEY,label text NOT NULL,enabled boolean NOT NULL DEFAULT false,last_seen timestamptz);
CREATE TABLE public.nhso_agent_reads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),station text NOT NULL REFERENCES public.nhso_agent_stations(id),actor uuid NOT NULL REFERENCES public.app_users(id),person_id text NOT NULL,expected_cid text NOT NULL,state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','reading','ready','failed')),owner uuid,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',pid text,main_inscl text,correlation_id text,claim_types jsonb,checked_at timestamptz,error_code text,intent_id uuid UNIQUE REFERENCES public.fit_close_intents(id));
CREATE UNIQUE INDEX nhso_agent_read_station_active ON public.nhso_agent_reads(station) WHERE state IN ('pending','reading');
ALTER TABLE public.nhso_agent_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhso_agent_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nhso_agent_stations,public.nhso_agent_reads FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nhso_agent_stations,public.nhso_agent_reads TO service_role;
CREATE FUNCTION public.nhso_agent_station_list() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT public.nhso_close_allowed() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'label',label,'online',last_seen>now()-interval '90 seconds') ORDER BY label) FROM public.nhso_agent_stations WHERE enabled),'[]'::jsonb);
END $$;
CREATE FUNCTION public.nhso_agent_read_request(p_person text,p_station text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid:=(public.app_current_user()->>'userId')::uuid; cid text; r public.nhso_agent_reads;
BEGIN
 IF NOT public.nhso_close_allowed() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.nhso_agent_stations WHERE id=p_station AND enabled AND last_seen>now()-interval '90 seconds' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'STATION_OFFLINE'; END IF;
 SELECT trim(p.cid) INTO cid FROM public.population p WHERE person_id=p_person;
 IF cid IS NULL OR cid !~ '^[0-9]{13}$' THEN RAISE EXCEPTION 'PERSON_REQUIRED'; END IF;
 SELECT * INTO r FROM public.nhso_agent_reads WHERE station=p_station AND state IN ('pending','reading');
 IF FOUND THEN
  IF r.actor=a AND r.person_id=p_person AND r.expires_at>now() THEN RETURN r.id; END IF;
  RAISE EXCEPTION 'STATION_BUSY';
 END IF;
 INSERT INTO public.nhso_agent_reads(station,actor,person_id,expected_cid) VALUES(p_station,a,p_person,cid) RETURNING * INTO r;
 RETURN r.id;
END $$;
CREATE FUNCTION public.nhso_agent_read_status(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.nhso_agent_reads;
BEGIN
 IF NOT public.nhso_close_allowed() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO r FROM public.nhso_agent_reads WHERE id=p_id AND actor=(public.app_current_user()->>'userId')::uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 RETURN jsonb_build_object('id',r.id,'state',r.state,'expired',r.expires_at<=now(),'mainInscl',r.main_inscl,'claimTypes',r.claim_types,'checkedAt',r.checked_at,'error',r.error_code,'intentId',r.intent_id);
END $$;
CREATE FUNCTION public.nhso_agent_read_claim(p_station text,p_owner uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.nhso_agent_reads;
BEGIN
 IF p_owner IS NULL THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
 UPDATE public.nhso_agent_stations SET last_seen=now() WHERE id=p_station AND enabled;
 IF NOT FOUND THEN RAISE EXCEPTION 'STATION_DISABLED'; END IF;
 UPDATE public.nhso_agent_reads SET state='failed',error_code='READ_EXPIRED' WHERE station=p_station AND state IN ('pending','reading') AND expires_at<=now();
 UPDATE public.nhso_agent_reads SET state='reading',owner=p_owner WHERE id=(SELECT id FROM public.nhso_agent_reads WHERE station=p_station AND state='pending' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING * INTO r;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',r.id,'expectedCid',r.expected_cid);
END $$;
CREATE FUNCTION public.nhso_agent_read_finish(p_id uuid,p_owner uuid,p_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.nhso_agent_reads; good boolean;
BEGIN
 SELECT * INTO r FROM public.nhso_agent_reads WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR r.owner IS DISTINCT FROM p_owner OR r.state<>'reading' THEN RAISE EXCEPTION 'READ_STATE_CHANGED'; END IF;
 good:=coalesce(r.expires_at>now() AND p_data->>'pid'=r.expected_cid AND length(p_data->>'correlationId') BETWEEN 1 AND 2048 AND length(p_data->>'mainInscl') BETWEEN 1 AND 100 AND jsonb_typeof(p_data->'claimTypes')='array',false);
 UPDATE public.nhso_agent_reads SET state=CASE WHEN good THEN 'ready' ELSE 'failed' END,pid=CASE WHEN good THEN p_data->>'pid' END,main_inscl=CASE WHEN good THEN p_data->>'mainInscl' END,correlation_id=CASE WHEN good THEN p_data->>'correlationId' END,claim_types=CASE WHEN good THEN p_data->'claimTypes' END,checked_at=now(),error_code=CASE WHEN good THEN NULL ELSE 'READ_OR_IDENTITY_FAILED' END WHERE id=p_id;
END $$;
CREATE FUNCTION public.nhso_agent_confirm(p_id uuid,p_result text,p_vn text,p_confirm boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.nhso_agent_reads; v_result jsonb; i public.fit_close_intents;
BEGIN
 IF NOT public.nhso_close_allowed() OR p_confirm IS DISTINCT FROM true THEN RAISE EXCEPTION 'MANUAL_APPROVAL_REQUIRED'; END IF;
 SELECT * INTO r FROM public.nhso_agent_reads WHERE id=p_id AND actor=(public.app_current_user()->>'userId')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'READ_REQUIRED'; END IF;
 IF r.intent_id IS NOT NULL THEN RETURN jsonb_build_object('id',r.intent_id,'sent',false); END IF;
 IF r.state<>'ready' OR r.expires_at<=now() OR NOT (r.claim_types @> '["PG0060001"]'::jsonb) THEN RAISE EXCEPTION 'FRESH_ENTITLEMENT_REQUIRED'; END IF;
 v_result:=public.fit_close_request(r.person_id,r.pid,p_result,true);
 SELECT * INTO i FROM public.fit_close_intents WHERE id=(v_result->>'id')::uuid FOR UPDATE;
 IF i.vn IS DISTINCT FROM p_vn OR i.requested_by<>r.actor OR i.state<>'pending' OR i.closure_id IS NOT NULL OR i.transport<>'direct' THEN RAISE EXCEPTION 'INTENT_CHANGED'; END IF;
 UPDATE public.fit_close_intents SET transport='agent' WHERE id=i.id;
 UPDATE public.nhso_agent_reads SET intent_id=i.id WHERE id=r.id;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.nhso_agent_station_list(),public.nhso_agent_read_request(text,text),public.nhso_agent_read_status(uuid),public.nhso_agent_confirm(uuid,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nhso_agent_station_list(),public.nhso_agent_read_request(text,text),public.nhso_agent_read_status(uuid),public.nhso_agent_confirm(uuid,text,text,boolean) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.nhso_agent_read_claim(text,uuid),public.nhso_agent_read_finish(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nhso_agent_read_claim(text,uuid),public.nhso_agent_read_finish(uuid,uuid,jsonb) TO service_role;

ALTER FUNCTION public.fit_close_reserve(uuid,jsonb,text,uuid,text,text) RENAME TO fit_close_reserve_internal;
REVOKE ALL ON FUNCTION public.fit_close_reserve_internal(uuid,jsonb,text,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.fit_close_reserve(p_intent uuid,p_expected jsonb,p_hash text,p_owner uuid,p_hcode text,p_service text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.fit_close_load(p_intent);
 PERFORM 1 FROM public.fit_close_intents WHERE id=p_intent AND transport='direct' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORT_MISMATCH'; END IF;
 RETURN public.fit_close_reserve_internal(p_intent,p_expected,p_hash,p_owner,p_hcode,p_service);
END $$;
CREATE FUNCTION public.nhso_agent_reserve(p_intent uuid,p_expected jsonb,p_hash text,p_owner uuid,p_hcode text,p_service text,p_station text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.fit_close_load(p_intent);
 PERFORM 1 FROM public.fit_close_intents WHERE id=p_intent AND transport='agent' FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.nhso_agent_reads r JOIN public.nhso_agent_stations s ON s.id=r.station WHERE r.intent_id=p_intent AND r.station=p_station AND s.enabled AND r.state='ready' AND r.expires_at>now() AND r.pid=p_expected->>'cid' AND r.actor::text=p_expected->>'actor_id' AND r.claim_types @> jsonb_build_array(p_service)) THEN RAISE EXCEPTION 'FRESH_ENTITLEMENT_REQUIRED'; END IF;
 RETURN public.fit_close_reserve_internal(p_intent,p_expected,p_hash,p_owner,p_hcode,p_service);
END $$;
REVOKE ALL ON FUNCTION public.fit_close_reserve(uuid,jsonb,text,uuid,text,text),public.nhso_agent_reserve(uuid,jsonb,text,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fit_close_reserve(uuid,jsonb,text,uuid,text,text),public.nhso_agent_reserve(uuid,jsonb,text,uuid,text,text,text) TO service_role;

CREATE FUNCTION public.nhso_agent_sync_outcome(p_intent uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public.fit_close_intents i SET state=CASE WHEN c.state='confirmed' THEN 'confirmed' ELSE 'reconcile' END FROM public.nhso_close_submissions c WHERE i.id=p_intent AND i.transport='agent' AND i.closure_id=c.id AND i.state='reserved' AND c.state IN ('confirmed','outcome_unknown');
 UPDATE public.nhso_agent_reads r SET correlation_id=NULL WHERE r.intent_id=p_intent AND EXISTS(SELECT 1 FROM public.fit_close_intents i WHERE i.id=p_intent AND i.state IN ('confirmed','reconcile','written'));
END $$;
REVOKE ALL ON FUNCTION public.nhso_agent_sync_outcome(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nhso_agent_sync_outcome(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
