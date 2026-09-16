BEGIN;
-- Preserve baseline provenance; only FIT baseline is enabled for review.
DO $migration$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('public.screening_review_list(integer)'::regprocedure);
 IF position('WHERE h.source<>''baseline'' AND' in definition)=0 THEN RAISE EXCEPTION 'UNEXPECTED_REVIEW_LIST'; END IF;
 EXECUTE replace(definition,'WHERE h.source<>''baseline'' AND','WHERE (h.source<>''baseline'' OR h.kpi=''FOBT'') AND');
 definition:=pg_get_functiondef('public.screening_review_approve(uuid)'::regprocedure);
 IF position('OR h.source=''baseline'' OR' in definition)=0 THEN RAISE EXCEPTION 'UNEXPECTED_REVIEW_APPROVE'; END IF;
 definition:=replace(definition,'OR h.source=''baseline'' OR','OR (h.source=''baseline'' AND h.kpi<>''FOBT'') OR');
 definition:=replace(definition,'INSERT INTO public.screening_review(history_id,approved_by,approved_name)',
 'IF h.kpi=''FOBT'' AND ((p.fobt_screen,p.fobt_date) IS DISTINCT FROM (h.result,h.screen_date) OR EXISTS(SELECT 1 FROM public.screening_history newer WHERE newer.person_id=h.person_id AND newer.kpi=''FOBT'' AND newer.recorded_at>h.recorded_at)) THEN RAISE EXCEPTION ''FIT_CHANGED_REFRESH''; END IF;
 INSERT INTO public.screening_review(history_id,approved_by,approved_name)');
 EXECUTE definition;
 definition:=pg_get_functiondef('public.hosxp_fit_preview(uuid)'::regprocedure);
 IF position('OR h.source=''baseline'' OR' in definition)=0 THEN RAISE EXCEPTION 'UNEXPECTED_FIT_PREVIEW'; END IF;
 EXECUTE replace(definition,'OR h.source=''baseline'' OR','OR');
END $migration$;
NOTIFY pgrst,'reload schema';
COMMIT;
