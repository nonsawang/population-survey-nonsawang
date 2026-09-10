-- Phase 1: additive only. Deploy the matching server routes before phase 2.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS app_private.sessions (
 token_hash text PRIMARY KEY, actor_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_sessions_actor_idx ON app_private.sessions(actor_id);
CREATE TABLE IF NOT EXISTS app_private.login_attempts (
 bucket text NOT NULL, attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_login_attempts_idx ON app_private.login_attempts(bucket,attempted_at);
REVOKE ALL ON ALL TABLES IN SCHEMA app_private FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION app_private.password_matches(p_password text,p_hash text) RETURNS boolean
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE digest text := encode(sha256(convert_to(p_password,'UTF8')),'hex');
BEGIN
 IF p_password IS NULL OR length(p_password)>1024 OR p_hash IS NULL THEN RETURN false; END IF;
 IF p_hash LIKE 'bcrypt-sha256:%' THEN
  RETURN extensions.crypt(digest,substring(p_hash from 15))=substring(p_hash from 15);
 END IF;
 IF p_hash ~ '^[a-fA-F0-9]{40}$' THEN
  RETURN lower(p_hash)=encode(extensions.digest(p_password,'sha1'),'hex');
 END IF;
 RETURN p_hash ~ '^[a-fA-F0-9]{64}$' AND lower(p_hash)=digest;
END $$;
CREATE OR REPLACE FUNCTION app_private.password_hash(p_password text) RETURNS text
LANGUAGE sql SET search_path=pg_catalog AS $$
 SELECT 'bcrypt-sha256:' || extensions.crypt(encode(sha256(convert_to(p_password,'UTF8')),'hex'),extensions.gen_salt('bf',12));
$$;

CREATE OR REPLACE FUNCTION public.app_current_user() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('userId',u.id,'username',u.username,'displayName',u.display_name,
   'role',u.role,'moo',coalesce(u.moo,''),'avatarUrl',u.avatar_url)
 FROM app_private.sessions s JOIN public.app_users u ON u.id=s.actor_id
 WHERE s.token_hash=encode(sha256(convert_to(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-app-session',''),'UTF8')),'hex')
 AND s.expires_at>now() AND u.is_active=true AND u.role IN ('admin','staff','vhv','manager');
$$;

CREATE OR REPLACE FUNCTION app_private.in_scope(p_moo text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce((SELECT CASE WHEN a->>'role' IN ('admin','staff','manager') THEN true
 WHEN a->>'role'='vhv' THEN trim(p_moo)=ANY(regexp_split_to_array(trim(a->>'moo'),'\s*,\s*')) AND trim(coalesce(p_moo,''))<>''
 ELSE false END FROM (SELECT public.app_current_user() a) x),false);
$$;

CREATE OR REPLACE FUNCTION app_private.issue_session(p_actor uuid,p_token_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'INVALID_SESSION'; END IF;
 DELETE FROM app_private.sessions WHERE expires_at<=now();
 INSERT INTO app_private.sessions(token_hash,actor_id,expires_at) VALUES(p_token_hash,p_actor,now()+interval '8 hours');
 UPDATE public.app_users SET last_login=now() WHERE id=p_actor;
 SELECT jsonb_build_object('userId',id,'username',username,'displayName',display_name,'role',role,'moo',coalesce(moo,''),'avatarUrl',avatar_url)
 INTO result FROM public.app_users WHERE id=p_actor;
 INSERT INTO public.activity_logs(user_id,username,action,details) VALUES(p_actor,result->>'username','LOGIN','ยืนยันตัวตนฝั่งเซิร์ฟเวอร์');
 RETURN jsonb_build_object('user',result);
END $$;

-- Callable only with the server service-role key; LINE identity is verified by the server.
CREATE OR REPLACE FUNCTION public.app_auth_password(p_username text,p_password text,p_token_hash text,p_line_id text DEFAULT NULL,p_avatar text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u public.app_users%ROWTYPE; name text:=lower(trim(p_username));
BEGIN
 IF name IS NULL OR name='' OR length(name)>150 OR p_password IS NULL OR length(p_password)>1024 THEN RETURN jsonb_build_object('error','INVALID_LOGIN'); END IF;
 PERFORM pg_advisory_xact_lock(hashtext('app-login:'||name));
 DELETE FROM app_private.login_attempts WHERE attempted_at<now()-interval '1 day';
 IF (SELECT count(*) FROM app_private.login_attempts WHERE bucket=name AND attempted_at>now()-interval '15 minutes')>=10 THEN RETURN jsonb_build_object('error','RATE_LIMITED'); END IF;
 SELECT * INTO u FROM public.app_users WHERE lower(username)=name FOR UPDATE;
 IF (SELECT count(*) FROM public.app_users WHERE lower(username)=name)<>1 OR u.id IS NULL OR NOT coalesce(u.is_active,false) OR u.role NOT IN ('admin','staff','vhv','manager') OR NOT app_private.password_matches(p_password,u.password_hash) THEN
  INSERT INTO app_private.login_attempts(bucket) VALUES(name);
  RETURN jsonb_build_object('error','INVALID_LOGIN');
 END IF;
 IF p_line_id IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtext('app-line:'||p_line_id));
  IF (u.line_user_id IS NOT NULL AND u.line_user_id<>p_line_id) OR EXISTS(SELECT 1 FROM public.app_users WHERE line_user_id=p_line_id AND id<>u.id) THEN RETURN jsonb_build_object('error','LINE_ALREADY_LINKED'); END IF;
  UPDATE public.app_users SET line_user_id=p_line_id,avatar_url=p_avatar WHERE id=u.id;
 END IF;
 IF u.password_hash NOT LIKE 'bcrypt-sha256:%' THEN UPDATE public.app_users SET password_hash=app_private.password_hash(p_password) WHERE id=u.id; END IF;
 DELETE FROM app_private.login_attempts WHERE bucket=name;
 RETURN app_private.issue_session(u.id,p_token_hash);
END $$;

CREATE OR REPLACE FUNCTION public.app_auth_line(p_line_id text,p_avatar text,p_token_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid;
BEGIN
 IF p_line_id IS NULL OR p_line_id='' THEN RETURN jsonb_build_object('error','INVALID_LOGIN'); END IF;
 IF (SELECT count(*) FROM public.app_users WHERE line_user_id=p_line_id)<>1 THEN RETURN jsonb_build_object('error','NOT_LINKED'); END IF;
 SELECT id INTO actor FROM public.app_users WHERE line_user_id=p_line_id AND is_active=true AND role IN ('admin','staff','vhv','manager') FOR UPDATE;
 IF actor IS NULL THEN RETURN jsonb_build_object('error','INVALID_LOGIN'); END IF;
 UPDATE public.app_users SET avatar_url=p_avatar WHERE id=actor;
 RETURN app_private.issue_session(actor,p_token_hash);
END $$;

CREATE OR REPLACE FUNCTION public.app_logout() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 DELETE FROM app_private.sessions WHERE token_hash=encode(sha256(convert_to(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-app-session',''),'UTF8')),'hex');
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.app_change_password(p_old text,p_new text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=(public.app_current_user()->>'userId')::uuid; stored text; attempt_bucket text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_new IS NULL OR length(p_new)<8 OR length(p_new)>1024 THEN RETURN jsonb_build_object('error','รหัสผ่านใหม่ต้องมี 8–1024 ตัวอักษร'); END IF;
 attempt_bucket:='change:'||actor::text;
 PERFORM pg_advisory_xact_lock(hashtext(attempt_bucket));
 IF (SELECT count(*) FROM app_private.login_attempts a WHERE a.bucket=attempt_bucket AND attempted_at>now()-interval '15 minutes')>=10 THEN RETURN jsonb_build_object('error','กรุณารอ 15 นาทีแล้วลองใหม่'); END IF;
 SELECT password_hash INTO stored FROM public.app_users WHERE id=actor FOR UPDATE;
 IF NOT app_private.password_matches(p_old,stored) THEN
  INSERT INTO app_private.login_attempts(bucket) VALUES(attempt_bucket);
  RETURN jsonb_build_object('error','รหัสผ่านเดิมไม่ถูกต้อง');
 END IF;
 UPDATE public.app_users SET password_hash=app_private.password_hash(p_new) WHERE id=actor;
 DELETE FROM app_private.sessions WHERE actor_id=actor;
 DELETE FROM public.hosxp_review_sessions WHERE actor_id=actor::text;
 INSERT INTO public.activity_logs(user_id,username,action,details) SELECT id,username,'CHANGE_PASSWORD','เปลี่ยนรหัสผ่านและยกเลิกเซสชันเดิม' FROM public.app_users WHERE id=actor;
 RETURN jsonb_build_object('success',true);
END $$;

CREATE OR REPLACE FUNCTION public.app_admin_save_user(p_id uuid,p_username text,p_display_name text,p_role text,p_moo text,p_active boolean,p_password text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a jsonb:=public.app_current_user(); target uuid; previous public.app_users%ROWTYPE;
BEGIN
 IF a IS NULL OR a->>'role'<>'admin' THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
 IF p_role IS NULL OR p_role NOT IN ('admin','staff','vhv','manager') OR coalesce(trim(p_display_name),'')='' OR length(p_display_name)>150 OR p_active IS NULL THEN RAISE EXCEPTION 'INVALID_USER'; END IF;
 IF coalesce(p_password,'')<>'' AND (length(p_password)<8 OR length(p_password)>1024) THEN RAISE EXCEPTION 'PASSWORD_TOO_SHORT'; END IF;
 IF p_role='vhv' AND coalesce(trim(p_moo),'') !~ '^[0-9]+(\s*,\s*[0-9]+)*$' THEN RAISE EXCEPTION 'VILLAGE_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('app-admin-users'));
 IF p_id IS NULL THEN
  IF coalesce(trim(p_username),'') !~ '^[a-zA-Z0-9_.-]{3,150}$' OR coalesce(p_password,'')='' THEN RAISE EXCEPTION 'INVALID_USER'; END IF;
  IF EXISTS(SELECT 1 FROM public.app_users WHERE lower(username)=lower(trim(p_username))) THEN RAISE EXCEPTION 'USERNAME_EXISTS'; END IF;
  INSERT INTO public.app_users(username,password_hash,display_name,role,moo,is_active)
  VALUES(lower(trim(p_username)),app_private.password_hash(p_password),trim(p_display_name),p_role,nullif(trim(p_moo),''),p_active) RETURNING id INTO target;
 ELSE
  SELECT * INTO previous FROM public.app_users WHERE id=p_id FOR UPDATE;
  IF previous.id IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF previous.role='admin' AND previous.is_active AND (p_role<>'admin' OR NOT p_active) AND NOT EXISTS(SELECT 1 FROM public.app_users WHERE role='admin' AND is_active AND id<>p_id) THEN RAISE EXCEPTION 'LAST_ADMIN'; END IF;
  UPDATE public.app_users SET display_name=trim(p_display_name),role=p_role,moo=nullif(trim(p_moo),''),is_active=p_active,
   password_hash=CASE WHEN coalesce(p_password,'')='' THEN password_hash ELSE app_private.password_hash(p_password) END WHERE id=p_id;
  target:=p_id;
  DELETE FROM app_private.sessions WHERE actor_id=target;
  DELETE FROM public.hosxp_review_sessions WHERE actor_id=target::text;
 END IF;
 INSERT INTO public.activity_logs(user_id,username,action,details,target_id)
 VALUES((a->>'userId')::uuid,a->>'username','ADMIN_SAVE_USER','ปรับบัญชีผู้ใช้และสิทธิ์',target::text);
 RETURN jsonb_build_object('success',true,'id',target);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app_private.in_scope(text) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.app_auth_password(text,text,text,text,text),public.app_auth_line(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.app_auth_password(text,text,text,text,text),public.app_auth_line(text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.app_current_user(),public.app_logout(),public.app_change_password(text,text),public.app_admin_save_user(uuid,text,text,text,text,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_current_user(),public.app_logout(),public.app_change_password(text,text),public.app_admin_save_user(uuid,text,text,text,text,boolean,text) TO anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
