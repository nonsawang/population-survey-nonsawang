BEGIN;
CREATE TABLE public.person_identity_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id text NOT NULL, target_id text NOT NULL,
 fingerprint text NOT NULL, reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 500),
 requested_by text NOT NULL, requested_at timestamptz NOT NULL DEFAULT now(),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','applying','completed','blocked')),
 error_code text, completed_at timestamptz, before_data jsonb, after_data jsonb,
 CHECK(source_id<>target_id)
);
CREATE UNIQUE INDEX person_identity_pending ON public.person_identity_jobs(source_id) WHERE state IN ('pending','applying');
CREATE TABLE public.person_identity_links (
 person_id text PRIMARY KEY, hosxp_person_id text NOT NULL UNIQUE, hn text NOT NULL UNIQUE,
 cid text NOT NULL UNIQUE, verified_at timestamptz NOT NULL, job_id uuid NOT NULL REFERENCES public.person_identity_jobs(id)
);
CREATE TABLE public.person_identity_aliases (
 person_id text PRIMARY KEY, canonical_id text NOT NULL, job_id uuid NOT NULL REFERENCES public.person_identity_jobs(id),
 CHECK(person_id<>canonical_id)
);
ALTER TABLE public.person_identity_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_identity_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.person_identity_jobs,public.person_identity_links,public.person_identity_aliases FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.person_identity_jobs TO service_role;
GRANT SELECT ON public.person_identity_links,public.person_identity_aliases TO service_role;

-- Restrictive policy composes with the existing village permissions.
CREATE FUNCTION public.person_identity_active(p_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.person_identity_aliases WHERE person_id=p_id)
$$;
REVOKE ALL ON FUNCTION public.person_identity_active(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.person_identity_active(text) TO anon,authenticated;
CREATE POLICY population_identity_active ON public.population AS RESTRICTIVE FOR ALL TO anon,authenticated
 USING(public.person_identity_active(person_id)) WITH CHECK(public.person_identity_active(person_id));

CREATE FUNCTION app_private.person_identity_plan(p_source text,p_target text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s jsonb; t jsonb; bundle jsonb; reasons jsonb:='[]'; k text; f text; d text;
BEGIN
 SELECT to_jsonb(p) INTO s FROM public.population p WHERE person_id=p_source;
 SELECT to_jsonb(p) INTO t FROM public.population p WHERE person_id=p_target;
 IF s IS NULL OR t IS NULL OR p_source=p_target THEN RAISE EXCEPTION 'IDENTITY_PERSON_REQUIRED'; END IF;
 IF NOT public.hosxp_review_valid_cid(t->>'cid') THEN reasons:=reasons||'"TARGET_CID_INVALID"'::jsonb; END IF;
 IF coalesce(s->>'cid','')<>'' AND s->>'cid' IS DISTINCT FROM t->>'cid' THEN reasons:=reasons||'"CID_CONFLICT"'::jsonb; END IF;
 IF s->>'birth_date' IS NOT NULL AND t->>'birth_date' IS NOT NULL AND s->>'birth_date'<>t->>'birth_date' THEN reasons:=reasons||'"BIRTH_DATE_CONFLICT"'::jsonb; END IF;
 IF EXISTS(SELECT 1 FROM public.population WHERE cid=t->>'cid' AND person_id NOT IN(p_source,p_target)) THEN reasons:=reasons||'"OTHER_DUPLICATE_CID"'::jsonb; END IF;
 IF EXISTS(SELECT 1 FROM public.person_identity_aliases WHERE person_id IN(p_source,p_target) OR canonical_id=p_source)
 OR EXISTS(SELECT 1 FROM public.person_identity_links WHERE person_id=p_source) THEN reasons:=reasons||'"ALREADY_LINKED"'::jsonb; END IF;
 IF EXISTS(SELECT 1 FROM public.hosxp_fit_preparations j JOIN public.hosxp_fit_import_results r ON r.preparation_id=j.id WHERE j.person_id=p_source) THEN reasons:=reasons||'"SOURCE_ALREADY_IMPORTED"'::jsonb; END IF;
 IF EXISTS(SELECT 1 FROM public.hosxp_review_approvals WHERE population_id IN(p_source,p_target) AND state='approved') THEN reasons:=reasons||'"DEMOGRAPHIC_QUEUE_PENDING"'::jsonb; END IF;
 IF EXISTS(SELECT 1 FROM public.authen_report_writes w JOIN public.authen_report_batches b ON b.id=w.batch_id CROSS JOIN LATERAL jsonb_array_elements(b.results) r
 JOIN public.hosxp_fit_preparations j ON j.id::text=r->>'fitPreparationId' WHERE j.person_id=p_source AND r->>'row'=w.row_number::text) THEN reasons:=reasons||'"AUTHEN_APPROVAL_EXISTS"'::jsonb; END IF;
 IF EXISTS(SELECT 1 FROM public.screening_history a JOIN public.screening_history b ON a.kpi=b.kpi AND a.screen_date=b.screen_date WHERE a.person_id=p_source AND b.person_id=p_target) THEN reasons:=reasons||'"HISTORY_DATE_CONFLICT"'::jsonb; END IF;
 FOR k,f,d IN SELECT * FROM (VALUES('HEP','hep_screen','hep_date'),('FOBT','fobt_screen','fobt_date'),('HPV','hpv_screen','hpv_date'),('CHILD','child_dev','child_date')) v LOOP
  IF (coalesce(s->>f,'') NOT IN ('','-') OR s->>d IS NOT NULL) AND (coalesce(t->>f,'') NOT IN ('','-') OR t->>d IS NOT NULL) AND (s->>f,s->>d) IS DISTINCT FROM (t->>f,t->>d) THEN reasons:=reasons||to_jsonb(k||'_LATEST_CONFLICT'); END IF;
 END LOOP;
 bundle:=jsonb_build_object('source',s,'target',t,
 'histories',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM public.screening_history h WHERE person_id IN(p_source,p_target)),'[]'),
 'preparations',coalesce((SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM public.hosxp_fit_preparations j WHERE person_id IN(p_source,p_target)),'[]'),
 'reviews',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY history_id) FROM public.screening_review r JOIN public.screening_history h ON h.id=r.history_id WHERE h.person_id IN(p_source,p_target)),'[]'));
 RETURN bundle||jsonb_build_object('fingerprint',md5(bundle::text),'reasons',reasons);
END $$;
REVOKE ALL ON FUNCTION app_private.person_identity_plan(text,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.person_identity_search(p_query text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF coalesce(public.app_current_user()->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
 IF length(trim(p_query)) NOT BETWEEN 2 AND 100 THEN RETURN '[]'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT p.person_id,p.fname,p.lname,p.birth_date,p.house,p.moo,
 right(p.cid,4) AS cid_tail,a.canonical_id,l.hn,l.hosxp_person_id,l.verified_at
 FROM public.population p LEFT JOIN public.person_identity_aliases a USING(person_id) LEFT JOIN public.person_identity_links l USING(person_id)
 WHERE p.person_id=p_query OR p.cid=p_query OR strpos(coalesce(p.fname,'')||' '||coalesce(p.lname,''),trim(p_query))>0
 ORDER BY p.person_id LIMIT 30)x),'[]');
END $$;
CREATE FUNCTION public.person_identity_preview(p_source text,p_target text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE plan jsonb;
BEGIN
 IF coalesce(public.app_current_user()->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
 plan:=app_private.person_identity_plan(p_source,p_target);
 RETURN plan;
END $$;
CREATE FUNCTION public.person_identity_request(p_source text,p_target text,p_fingerprint text,p_reason text,p_confirm boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a jsonb:=public.app_current_user(); plan jsonb; result uuid;
BEGIN
 IF coalesce(a->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
 IF p_confirm IS DISTINCT FROM true OR length(trim(p_reason)) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'IDENTITY_CONFIRM_REQUIRED'; END IF;
 PERFORM 1 FROM public.population WHERE person_id IN(p_source,p_target) ORDER BY person_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.person_identity_jobs WHERE state IN ('pending','applying') AND (source_id IN(p_source,p_target) OR target_id IN(p_source,p_target))) THEN RAISE EXCEPTION 'IDENTITY_PENDING'; END IF;
 plan:=app_private.person_identity_plan(p_source,p_target);
 IF plan->>'fingerprint' IS DISTINCT FROM p_fingerprint OR plan->'reasons'<>'[]'::jsonb THEN RAISE EXCEPTION 'IDENTITY_CHANGED_OR_CONFLICT'; END IF;
 INSERT INTO public.person_identity_jobs(source_id,target_id,fingerprint,reason,requested_by) VALUES(p_source,p_target,p_fingerprint,trim(p_reason),a->>'userId') RETURNING id INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.person_identity_status() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF coalesce(public.app_current_user()->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,source_id,target_id,state,error_code,requested_at,completed_at FROM public.person_identity_jobs ORDER BY requested_at DESC LIMIT 20)x),'[]');
END $$;

-- Every ordinary writer (including a cached browser) stops on a queued/merged row.
CREATE FUNCTION public.person_identity_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE pid text:=CASE WHEN TG_OP='DELETE' THEN OLD.person_id ELSE NEW.person_id END;
BEGIN
 IF EXISTS(SELECT 1 FROM public.person_identity_aliases WHERE person_id=pid) THEN RAISE EXCEPTION 'PERSON_MERGED_REFRESH'; END IF;
 IF EXISTS(SELECT 1 FROM public.person_identity_jobs WHERE state='pending' AND (source_id=pid OR target_id=pid)) THEN RAISE EXCEPTION 'PERSON_IDENTITY_REVIEW_PENDING'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
IF TG_OP='UPDATE' AND NEW.person_id IS DISTINCT FROM OLD.person_id THEN RAISE EXCEPTION 'PERSON_ID_IMMUTABLE'; END IF;
IF EXISTS(SELECT 1 FROM public.person_identity_links WHERE person_id=pid AND cid IS DISTINCT FROM NEW.cid) THEN RAISE EXCEPTION 'LINKED_CID_IMMUTABLE'; END IF;
IF coalesce(NEW.cid,'')<>'' AND (TG_OP='INSERT' OR NEW.cid IS DISTINCT FROM OLD.cid) THEN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.cid,0));
 IF EXISTS(SELECT 1 FROM public.population WHERE cid=NEW.cid AND person_id<>pid) THEN RAISE EXCEPTION 'DUPLICATE_PERSON_CID'; END IF;
END IF; RETURN NEW;
END $$;
CREATE TRIGGER population_identity_guard BEFORE INSERT OR UPDATE OR DELETE ON public.population FOR EACH ROW EXECUTE FUNCTION public.person_identity_guard();

CREATE FUNCTION public.person_identity_apply(p_job uuid,p_verified jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.person_identity_jobs%ROWTYPE; plan jsonb; f text; d text;
BEGIN
 SELECT * INTO STRICT j FROM public.person_identity_jobs WHERE id=p_job FOR UPDATE;
 IF j.state='completed' THEN RETURN jsonb_build_object('state','completed'); END IF;
 IF j.state<>'pending' OR j.requested_at<now()-interval '24 hours' THEN RAISE EXCEPTION 'IDENTITY_REQUEST_EXPIRED'; END IF;
 PERFORM 1 FROM public.population WHERE person_id IN(j.source_id,j.target_id) ORDER BY person_id FOR UPDATE;
 LOCK TABLE public.screening_history,public.screening_review,public.hosxp_fit_preparations,public.hosxp_fit_import_results,public.authen_report_writes,public.hosxp_review_approvals IN SHARE ROW EXCLUSIVE MODE;
 plan:=app_private.person_identity_plan(j.source_id,j.target_id);
 IF plan->>'fingerprint'<>j.fingerprint OR plan->'reasons'<>'[]'::jsonb THEN RAISE EXCEPTION 'IDENTITY_CHANGED_OR_CONFLICT'; END IF;
 IF p_verified->>'cid' IS DISTINCT FROM plan->'target'->>'cid' OR coalesce(p_verified->>'hn','')='' OR coalesce(p_verified->>'hosxp_person_id','')='' THEN RAISE EXCEPTION 'IDENTITY_LAN_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM public.person_identity_links WHERE (cid=p_verified->>'cid' OR hn=p_verified->>'hn' OR hosxp_person_id=p_verified->>'hosxp_person_id') AND person_id<>j.target_id) THEN RAISE EXCEPTION 'IDENTITY_LINK_CONFLICT'; END IF;
 UPDATE public.person_identity_jobs SET state='applying',before_data=plan WHERE id=j.id;
 -- capture_screening_history recognizes this uncommitted audited correction.
 FOR f,d IN SELECT * FROM (VALUES('hep_screen','hep_date'),('fobt_screen','fobt_date'),('hpv_screen','hpv_date'),('child_dev','child_date')) v LOOP
  IF coalesce(plan->'target'->>f,'') IN ('','-') AND plan->'target'->>d IS NULL THEN
   EXECUTE format('UPDATE public.population SET %I=$1,%I=$2::date WHERE person_id=$3',f,d) USING plan->'source'->>f,plan->'source'->>d,j.target_id;
  END IF;
 END LOOP;
 UPDATE public.screening_history SET person_id=j.target_id WHERE person_id=j.source_id;
 UPDATE public.hosxp_fit_preparations SET person_id=j.target_id,payload=jsonb_set(payload,'{person_id}',to_jsonb(j.target_id)) WHERE person_id=j.source_id;
 UPDATE public.population SET cid=NULL,hep_screen='-',hep_date=NULL,fobt_screen='-',fobt_date=NULL,hpv_screen='-',hpv_date=NULL,child_dev='-',child_date=NULL WHERE person_id=j.source_id;
 INSERT INTO public.person_identity_links(person_id,hosxp_person_id,hn,cid,verified_at,job_id) VALUES(j.target_id,p_verified->>'hosxp_person_id',p_verified->>'hn',p_verified->>'cid',now(),j.id)
 ON CONFLICT(person_id) DO UPDATE SET verified_at=excluded.verified_at,job_id=excluded.job_id WHERE person_identity_links.hosxp_person_id=excluded.hosxp_person_id AND person_identity_links.hn=excluded.hn AND person_identity_links.cid=excluded.cid;
 IF NOT FOUND THEN RAISE EXCEPTION 'IDENTITY_LINK_CHANGED'; END IF;
 INSERT INTO public.person_identity_aliases VALUES(j.source_id,j.target_id,j.id);
 UPDATE public.person_identity_jobs SET state='completed',completed_at=now(),after_data=jsonb_build_object('target_id',j.target_id,'hosxp_person_id',p_verified->>'hosxp_person_id','hn',p_verified->>'hn','preparations',coalesce((SELECT jsonb_agg(p->>'id') FROM jsonb_array_elements(plan->'preparations') p),'[]'::jsonb)) WHERE id=j.id;
 INSERT INTO public.activity_logs(username,action,details,target_id) VALUES('LAN identity correction','PERSON_IDENTITY_MERGE',jsonb_build_object('job',j.id,'approved_by',j.requested_by,'source',j.source_id,'target',j.target_id,'reason',j.reason)::text,j.target_id);
 RETURN jsonb_build_object('state','completed');
END $$;
REVOKE ALL ON FUNCTION public.person_identity_apply(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.person_identity_apply(uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.person_identity_search(text),public.person_identity_preview(text,text),public.person_identity_request(text,text,text,text,boolean),public.person_identity_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.person_identity_search(text),public.person_identity_preview(text,text),public.person_identity_request(text,text,text,text,boolean),public.person_identity_status() TO anon,authenticated;
-- Preserve the existing trigger body; suppress only the transaction's audited merge.
DO $migration$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('public.capture_screening_history()'::regprocedure);
 IF position('oldrow:=' in definition)=0 THEN RAISE EXCEPTION 'UNEXPECTED_HISTORY_TRIGGER'; END IF;
 definition:=replace(definition,'oldrow:=','IF EXISTS(SELECT 1 FROM public.person_identity_jobs WHERE state=''applying'' AND (source_id=NEW.person_id OR target_id=NEW.person_id)) THEN RETURN NEW; END IF; oldrow:=');
 EXECUTE definition;
END $migration$;
NOTIFY pgrst,'reload schema';
COMMIT;
