-- Manual same-day intent only. A LAN worker must validate the live visit before sending.
BEGIN;
CREATE TABLE public.fit_close_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 preparation_id uuid NOT NULL UNIQUE REFERENCES public.hosxp_fit_preparations(id),
 history_id uuid NOT NULL REFERENCES public.screening_history(id),
 vn text NOT NULL UNIQUE,
 requested_by uuid NOT NULL REFERENCES public.app_users(id),
 requested_at timestamptz NOT NULL DEFAULT now(),
 result text NOT NULL,
 card_cid text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','reserved','confirmed','reconcile','written'))
);
ALTER TABLE public.fit_close_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fit_close_intents FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.fit_close_intents TO service_role;
-- Sending and changing state are deliberately not authorized by this migration.
CREATE FUNCTION public.fit_close_request(p_person text,p_card_cid text,p_result text,p_confirm boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor jsonb:=public.app_current_user(); h public.screening_history;
 p public.population; prep public.hosxp_fit_preparations; v public.hosxp_fit_import_results;
 intent public.fit_close_intents;
BEGIN
 IF NOT public.nhso_close_allowed() THEN RAISE EXCEPTION 'CLOSE_PERMISSION_REQUIRED'; END IF;
 IF p_confirm IS DISTINCT FROM true THEN RAISE EXCEPTION 'MANUAL_APPROVAL_REQUIRED'; END IF;
 SELECT * INTO p FROM public.population WHERE person_id=p_person FOR UPDATE;
 IF NOT FOUND OR p_card_cid IS NULL OR p_card_cid !~ '^[0-9]{13}$' OR trim(p.cid) IS DISTINCT FROM p_card_cid THEN RAISE EXCEPTION 'CARD_IDENTITY_MISMATCH'; END IF;
 SELECT * INTO h FROM public.screening_history WHERE person_id=p_person AND kpi='FOBT' ORDER BY recorded_at DESC,id DESC LIMIT 1;
 IF NOT FOUND OR h.source='baseline' OR h.result IS NULL OR h.result NOT IN ('ปกติ','ผิดปกติ') OR h.result IS DISTINCT FROM p_result
 OR h.screen_date IS DISTINCT FROM (now() AT TIME ZONE 'Asia/Bangkok')::date
 OR (p.fobt_screen,p.fobt_date) IS DISTINCT FROM (h.result,h.screen_date) THEN RAISE EXCEPTION 'CURRENT_DAY_FIT_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.screening_review WHERE history_id=h.id) THEN RAISE EXCEPTION 'FIT_APPROVAL_REQUIRED'; END IF;
 SELECT * INTO prep FROM public.hosxp_fit_preparations WHERE history_id=h.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'FIT_PREPARATION_REQUIRED'; END IF;
 SELECT * INTO v FROM public.hosxp_fit_import_results WHERE preparation_id=prep.id AND import_status='imported';
 IF NOT FOUND THEN RAISE EXCEPTION 'FIT_VISIT_REQUIRED'; END IF;
 INSERT INTO public.fit_close_intents(preparation_id,history_id,vn,requested_by,result,card_cid)
 VALUES(prep.id,h.id,v.vn,(actor->>'userId')::uuid,h.result,p_card_cid) ON CONFLICT(preparation_id) DO NOTHING;
 SELECT * INTO intent FROM public.fit_close_intents WHERE preparation_id=prep.id;
 IF intent.history_id IS DISTINCT FROM h.id OR intent.vn IS DISTINCT FROM v.vn OR intent.result IS DISTINCT FROM h.result OR intent.card_cid IS DISTINCT FROM p_card_cid THEN RAISE EXCEPTION 'FIT_INTENT_CHANGED'; END IF;
 RETURN jsonb_build_object('id',intent.id,'state',intent.state,'sent',false);
END $$;
REVOKE ALL ON FUNCTION public.fit_close_request(text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fit_close_request(text,text,text,boolean) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
