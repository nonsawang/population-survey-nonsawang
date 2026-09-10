-- Phase 2: coordinated cutover ONLY after server environment and deployment are ready.
-- Old browser-only login stops working when this transaction commits.
BEGIN;
DO $$ DECLARE item record; BEGIN
 IF to_regprocedure('public.app_current_user()') IS NULL THEN RAISE EXCEPTION 'RUN_AUTH_PREPARE_FIRST'; END IF;
 FOR item IN SELECT schemaname,tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('population','app_users','vhv_data','activity_logs') LOOP
  EXECUTE format('DROP POLICY %I ON %I.%I',item.policyname,item.schemaname,item.tablename);
 END LOOP;
END $$;
ALTER TABLE public.population ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vhv_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.population,public.app_users,public.vhv_data,public.activity_logs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.population TO anon,authenticated;
GRANT SELECT ON public.vhv_data TO anon,authenticated;
GRANT SELECT,INSERT ON public.activity_logs TO anon,authenticated;
GRANT USAGE ON SEQUENCE public.activity_logs_id_seq TO anon,authenticated;
GRANT SELECT(id,username,display_name,role,moo,is_active,last_login,created_at,avatar_url) ON public.app_users TO anon,authenticated;

CREATE POLICY population_read ON public.population FOR SELECT TO anon,authenticated USING (app_private.in_scope(moo));
CREATE POLICY population_insert ON public.population FOR INSERT TO anon,authenticated
 WITH CHECK ((SELECT public.app_current_user()->>'role') IN ('admin','staff','vhv') AND app_private.in_scope(moo));
CREATE POLICY population_update ON public.population FOR UPDATE TO anon,authenticated
 USING ((SELECT public.app_current_user()->>'role') IN ('admin','staff','vhv') AND app_private.in_scope(moo))
 WITH CHECK ((SELECT public.app_current_user()->>'role') IN ('admin','staff','vhv') AND app_private.in_scope(moo));
CREATE POLICY vhv_read ON public.vhv_data FOR SELECT TO anon,authenticated USING(app_private.in_scope(moo));
CREATE POLICY users_read ON public.app_users FOR SELECT TO anon,authenticated
 USING ((SELECT public.app_current_user()->>'role')='admin' OR id::text=(SELECT public.app_current_user()->>'userId'));
CREATE POLICY logs_read ON public.activity_logs FOR SELECT TO anon,authenticated USING((SELECT public.app_current_user()->>'role')='admin');
CREATE POLICY logs_insert ON public.activity_logs FOR INSERT TO anon,authenticated
 WITH CHECK (user_id::text=(SELECT public.app_current_user()->>'userId') AND username=(SELECT public.app_current_user()->>'username')
 AND (SELECT public.app_current_user()->>'role') IN ('admin','staff','vhv')
 AND action IN ('SCREENING_OV','RISK_BEHAVIOR','UPDATE_STATUS','CHANGE_VHV','MOVE_HOUSE','ADD_PERSON','UPDATE_PERSON'));

-- Retain the existing review workflow, but bind its reauthentication token to the app session.
CREATE OR REPLACE FUNCTION public.hosxp_review_actor(p_token text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor text;
BEGIN
 SELECT s.actor_id INTO actor FROM public.hosxp_review_sessions s JOIN public.app_users u ON u.id::text=s.actor_id
 WHERE s.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND s.expires_at>now()
 AND u.is_active=true AND u.role IN ('staff','admin') AND u.id::text=public.app_current_user()->>'userId';
 IF actor IS NULL THEN RAISE EXCEPTION 'REVIEW_SESSION_EXPIRED'; END IF;
 RETURN actor;
END $$;
CREATE OR REPLACE FUNCTION public.hosxp_review_open_session(p_username text,p_password text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a jsonb:=public.app_current_user(); actor text; token text; name text:=lower(trim(p_username));
BEGIN
 IF a IS NULL OR a->>'role' NOT IN ('staff','admin') OR name IS DISTINCT FROM lower(a->>'username') THEN RETURN jsonb_build_object('error','กรุณาเข้าสู่ระบบเจ้าหน้าที่'); END IF;
 IF p_password IS NULL OR length(p_password)>1024 THEN RETURN jsonb_build_object('error','รหัสผ่านไม่ถูกต้อง'); END IF;
 PERFORM pg_advisory_xact_lock(hashtext('hosxp-review-login:'||name));
 IF (SELECT count(*) FROM public.hosxp_review_login_attempts WHERE username=name AND attempted_at>now()-interval '15 minutes')>=10 THEN RETURN jsonb_build_object('error','กรุณารอ 15 นาทีแล้วลองใหม่'); END IF;
 SELECT id::text INTO actor FROM public.app_users WHERE id::text=a->>'userId' AND app_private.password_matches(p_password,password_hash);
 IF actor IS NULL THEN
  INSERT INTO public.hosxp_review_login_attempts(username) VALUES(name);
  RETURN jsonb_build_object('error','รหัสผ่านไม่ถูกต้อง');
 END IF;
 token:=gen_random_uuid()::text||gen_random_uuid()::text;
 INSERT INTO public.hosxp_review_sessions VALUES(encode(sha256(convert_to(token,'UTF8')),'hex'),actor,now()+interval '30 minutes');
 RETURN jsonb_build_object('token',token,'expires_at',now()+interval '30 minutes');
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
