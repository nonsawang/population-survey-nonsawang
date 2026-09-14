-- Preparation only: these rows must never be consumed as authorization to write HOSxP.
BEGIN;
CREATE TABLE public.hosxp_fit_preparations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 history_id uuid NOT NULL UNIQUE REFERENCES public.screening_history(id),
 person_id text NOT NULL, screen_date date NOT NULL,
 payload jsonb NOT NULL, prepared_by text NOT NULL, prepared_at timestamptz NOT NULL DEFAULT now(),
 state text NOT NULL DEFAULT 'awaiting_lan_validation' CHECK(state='awaiting_lan_validation'),
 UNIQUE(person_id,screen_date)
);
ALTER TABLE public.hosxp_fit_preparations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hosxp_fit_preparations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.hosxp_fit_preparations TO anon,authenticated;
CREATE POLICY fit_preparations_staff ON public.hosxp_fit_preparations FOR SELECT TO anon,authenticated
 USING ((SELECT public.app_current_user()->>'role') IN ('staff','admin'));

CREATE FUNCTION public.hosxp_fit_preview(p_history uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor jsonb:=public.app_current_user(); h public.screening_history; p public.population; draft public.hosxp_fit_preparations;
BEGIN
 IF coalesce(actor->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
 SELECT * INTO h FROM public.screening_history WHERE id=p_history;
 IF NOT FOUND OR h.kpi<>'FOBT' OR h.source='baseline' OR h.result NOT IN ('ปกติ','ผิดปกติ') OR h.result IS NULL
 OR h.screen_date IS NULL OR h.screen_date>(now() AT TIME ZONE 'Asia/Bangkok')::date THEN RAISE EXCEPTION 'INVALID_FIT_EVENT'; END IF;
 SELECT * INTO p FROM public.population WHERE person_id=h.person_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'PERSON_NOT_FOUND'; END IF;
 IF (p.fobt_screen,p.fobt_date) IS DISTINCT FROM (h.result,h.screen_date) OR EXISTS (
 SELECT 1 FROM public.screening_history newer WHERE newer.person_id=h.person_id AND newer.kpi='FOBT' AND newer.recorded_at>h.recorded_at
 ) THEN RAISE EXCEPTION 'FIT_CHANGED_REFRESH'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.screening_review WHERE history_id=h.id) THEN RAISE EXCEPTION 'FIT_APPROVAL_REQUIRED'; END IF;
 SELECT * INTO draft FROM public.hosxp_fit_preparations WHERE person_id=h.person_id AND screen_date=h.screen_date;
 IF FOUND AND draft.history_id<>h.id THEN RAISE EXCEPTION 'FIT_DATE_ALREADY_PREPARED'; END IF;
 RETURN jsonb_build_object('history_id',h.id,'person_id',h.person_id,'screen_date',h.screen_date,
 'source_result',h.result,'lab_result',CASE h.result WHEN 'ปกติ' THEN 'Negative' ELSE 'Positive' END,
 'mapping_version','fit-20260914','lab_code',10214,'fee_code','3905544','department_code','048','specialty_code','15',
 'doctor_code','0029','diagnosis','Z121','visit_policy','new_visit_per_screening_type',
 'state',coalesce(draft.state,'not_prepared'),'prepared_at',draft.prepared_at,'import_enabled',false);
END $$;

CREATE FUNCTION public.hosxp_fit_prepare(p_history uuid,p_confirmed_result text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor jsonb:=public.app_current_user(); preview jsonb; person text; draft public.hosxp_fit_preparations;
BEGIN
 IF coalesce(actor->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
 SELECT person_id INTO person FROM public.screening_history WHERE id=p_history;
 IF person IS NULL THEN RAISE EXCEPTION 'INVALID_FIT_EVENT'; END IF;
 -- Serialize preparations and source edits for the same person.
 PERFORM 1 FROM public.population WHERE person_id=person FOR UPDATE;
 preview:=public.hosxp_fit_preview(p_history);
 IF p_confirmed_result IS DISTINCT FROM preview->>'lab_result' THEN RAISE EXCEPTION 'FIT_RESULT_CONFIRMATION_REQUIRED'; END IF;
 INSERT INTO public.hosxp_fit_preparations(history_id,person_id,screen_date,payload,prepared_by)
 VALUES(p_history,person,(preview->>'screen_date')::date,preview-'state'-'prepared_at',actor->>'userId')
 ON CONFLICT(history_id) DO NOTHING;
 SELECT * INTO draft FROM public.hosxp_fit_preparations WHERE history_id=p_history;
 RETURN jsonb_build_object('id',draft.id,'state',draft.state,'prepared_at',draft.prepared_at,'import_enabled',false);
END $$;
REVOKE ALL ON FUNCTION public.hosxp_fit_preview(uuid),public.hosxp_fit_prepare(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hosxp_fit_preview(uuid),public.hosxp_fit_prepare(uuid,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
