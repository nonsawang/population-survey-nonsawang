-- Restore review authentication after legacy review migration was reapplied.
BEGIN;
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

