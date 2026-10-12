BEGIN;
ALTER TABLE public.fit_close_intents ADD COLUMN closure_id uuid UNIQUE REFERENCES public.nhso_close_submissions(id);
CREATE FUNCTION public.fit_close_load(p_intent uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE i public.fit_close_intents; h public.screening_history; p public.population;
BEGIN
 SELECT * INTO i FROM public.fit_close_intents WHERE id=p_intent;
 IF NOT FOUND THEN RAISE EXCEPTION 'INTENT_NOT_FOUND'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.app_users u JOIN public.nhso_close_permissions a ON a.user_id=u.id WHERE u.id=i.requested_by AND u.is_active AND u.role IN ('staff','admin') AND a.enabled) THEN RAISE EXCEPTION 'CLOSE_PERMISSION_REQUIRED'; END IF;
 SELECT * INTO h FROM public.screening_history WHERE id=i.history_id;
 IF NOT FOUND OR h.kpi<>'FOBT' OR h.source='baseline' OR h.result IS DISTINCT FROM i.result OR h.result NOT IN ('ปกติ','ผิดปกติ') OR h.screen_date IS DISTINCT FROM (now() AT TIME ZONE 'Asia/Bangkok')::date THEN RAISE EXCEPTION 'CURRENT_FIT_REQUIRED'; END IF;
 SELECT * INTO p FROM public.population WHERE person_id=h.person_id FOR UPDATE;
 IF NOT FOUND OR trim(p.cid) IS DISTINCT FROM i.card_cid OR (p.fobt_screen,p.fobt_date) IS DISTINCT FROM (h.result,h.screen_date) OR EXISTS(SELECT 1 FROM public.screening_history n WHERE n.person_id=h.person_id AND n.kpi='FOBT' AND (n.recorded_at,n.id)>(h.recorded_at,h.id)) THEN RAISE EXCEPTION 'FIT_CHANGED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.screening_review WHERE history_id=h.id) OR NOT EXISTS(SELECT 1 FROM public.hosxp_fit_preparations f JOIN public.hosxp_fit_import_results v ON v.preparation_id=f.id WHERE f.id=i.preparation_id AND f.history_id=h.id AND v.vn=i.vn AND v.import_status='imported') THEN RAISE EXCEPTION 'FIT_IMPORT_REQUIRED'; END IF;
 RETURN jsonb_build_object('intent_id',i.id,'preparation_id',i.preparation_id,'history_id',h.id,'person_id',h.person_id,'cid',trim(p.cid),'screen_date',h.screen_date,'result',h.result,'recorded_at',h.recorded_at,'vn',i.vn,'actor_id',i.requested_by);
END $$;
CREATE FUNCTION public.fit_close_reserve(p_intent uuid,p_expected jsonb,p_hash text,p_owner uuid,p_hcode text,p_service text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE i public.fit_close_intents; r public.nhso_close_submissions; snapshot jsonb; inserted boolean;
BEGIN
 -- Lock population before intent to match the UI request lock order.
 snapshot:=public.fit_close_load(p_intent);
 SELECT * INTO i FROM public.fit_close_intents WHERE id=p_intent FOR UPDATE;
 IF snapshot IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'SNAPSHOT_CHANGED'; END IF;
 IF p_service IS DISTINCT FROM 'PG0060001' THEN RAISE EXCEPTION 'SERVICE_NOT_CONFIGURED'; END IF;
 IF i.closure_id IS NOT NULL THEN
  SELECT * INTO r FROM public.nhso_close_submissions WHERE id=i.closure_id;
  IF r.request_hash IS DISTINCT FROM p_hash OR r.hcode IS DISTINCT FROM p_hcode OR r.service_code IS DISTINCT FROM p_service THEN RAISE EXCEPTION 'PAYLOAD_CHANGED'; END IF;
  RETURN jsonb_build_object('id',r.id,'transactionId',r.transaction_id,'acquired',false);
 END IF;
 IF i.state<>'pending' THEN RAISE EXCEPTION 'INTENT_NOT_PENDING'; END IF;
 INSERT INTO public.nhso_close_submissions(zone,hcode,visit_number,service_code,request_hash,owner_id)
 VALUES('production',p_hcode,i.vn,p_service,p_hash,p_owner) ON CONFLICT DO NOTHING RETURNING * INTO r;
 inserted:=FOUND;
 IF NOT inserted THEN RAISE EXCEPTION 'EXISTING_CLOSURE_REQUIRES_RECONCILIATION'; END IF;
 UPDATE public.fit_close_intents SET closure_id=r.id,state='reserved' WHERE id=i.id;
 RETURN jsonb_build_object('id',r.id,'transactionId',r.transaction_id,'acquired',true);
END $$;
REVOKE ALL ON FUNCTION public.fit_close_load(uuid),public.fit_close_reserve(uuid,jsonb,text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fit_close_load(uuid),public.fit_close_reserve(uuid,jsonb,text,uuid,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
