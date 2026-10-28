BEGIN;
CREATE TABLE public.hosxp_review_dispatch (
 approval_id uuid PRIMARY KEY REFERENCES public.hosxp_review_approvals(id),
 reserved_at timestamptz NOT NULL DEFAULT now(),
 outcome text NOT NULL DEFAULT 'reserved' CHECK(outcome IN ('reserved','sent','failed')),
 finished_at timestamptz
);
ALTER TABLE public.hosxp_review_dispatch ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hosxp_review_dispatch FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.hosxp_review_reserve(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a record; c record;
BEGIN
 SELECT * INTO a FROM public.hosxp_review_approvals WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR a.state<>'approved' THEN RAISE EXCEPTION 'NOT_APPROVED'; END IF;
 PERFORM 1 FROM public.population WHERE person_id=a.population_id FOR UPDATE;
 SELECT * INTO c FROM public.hosxp_review_candidates WHERE population_id=a.population_id;
 IF NOT FOUND OR c.review_status<>'approved' OR c.approval_id IS DISTINCT FROM a.id
 OR c.fingerprint IS DISTINCT FROM a.fingerprint OR c.target_id IS DISTINCT FROM a.target_person_id
 THEN RAISE EXCEPTION 'REVIEW_CHANGED_REFRESH'; END IF;
 INSERT INTO public.hosxp_review_dispatch(approval_id) VALUES(p_id);
 RETURN to_jsonb(a)||jsonb_build_object('cid',c.cid);
END $$;
CREATE FUNCTION public.hosxp_review_finish(p_id uuid,p_outcome text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE d record;
BEGIN
 IF p_outcome NOT IN ('sent','failed') THEN RAISE EXCEPTION 'INVALID_OUTCOME'; END IF;
 SELECT * INTO d FROM public.hosxp_review_dispatch WHERE approval_id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_RESERVED'; END IF;
 IF d.outcome=p_outcome THEN RETURN; END IF;
 IF d.outcome<>'reserved' THEN RAISE EXCEPTION 'OUTCOME_CONFLICT'; END IF;
 UPDATE public.hosxp_review_dispatch SET outcome=p_outcome,finished_at=now() WHERE approval_id=p_id;
 UPDATE public.hosxp_review_approvals SET state=p_outcome WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.hosxp_review_reserve(uuid),public.hosxp_review_finish(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hosxp_review_reserve(uuid),public.hosxp_review_finish(uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
