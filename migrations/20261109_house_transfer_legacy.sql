-- Preserve old pending logs. Never infer approval or a historical source version.
BEGIN;
ALTER TABLE public.house_transfer_requests ADD COLUMN IF NOT EXISTS legacy_log_id bigint UNIQUE;
CREATE TABLE IF NOT EXISTS public.house_transfer_legacy_review (
 log_id bigint PRIMARY KEY,
 request_id bigint REFERENCES public.house_transfer_requests(id),
 disposition text NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.house_transfer_legacy_review ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.house_transfer_legacy_review FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.house_transfer_legacy_review TO service_role;
DO $$
DECLARE l record; d jsonb; p public.population%ROWTYPE; u public.app_users%ROWTYPE; new_id bigint;
BEGIN
 FOR l IN SELECT * FROM public.activity_logs WHERE action='MOVE_REQUEST_PENDING' ORDER BY created_at DESC,id DESC LOOP
  IF EXISTS(SELECT 1 FROM public.house_transfer_legacy_review WHERE log_id=l.id) THEN CONTINUE; END IF;
  BEGIN
   d:=l.details::jsonb;
   SELECT * INTO p FROM public.population WHERE person_id=l.target_id FOR UPDATE;
   IF NOT FOUND OR d->>'personId' IS DISTINCT FROM l.target_id THEN RAISE EXCEPTION 'SOURCE_MISSING'; END IF;
   SELECT * INTO u FROM public.app_users WHERE id=l.user_id;
   IF NOT FOUND OR u.username IS DISTINCT FROM l.username THEN RAISE EXCEPTION 'AUTHOR_UNVERIFIED'; END IF;
   IF trim(p.moo::text) IS DISTINCT FROM d->>'fromMoo' OR trim(p.house) IS DISTINCT FROM d->>'fromHouse' THEN RAISE EXCEPTION 'SOURCE_CHANGED'; END IF;
   IF NOT app_private.valid_moo(d->>'toMoo') OR NOT EXISTS(SELECT 1 FROM public.population WHERE trim(moo::text)=d->>'toMoo' AND trim(house)=d->>'toHouse') THEN RAISE EXCEPTION 'TARGET_MISSING'; END IF;
   IF EXISTS(SELECT 1 FROM public.house_transfer_requests WHERE person_id=p.person_id AND state='pending') THEN RAISE EXCEPTION 'NEWER_REQUEST_EXISTS'; END IF;
   INSERT INTO public.house_transfer_requests(person_id,fullname,from_moo,from_house,from_vhv,source_updated_at,to_moo,to_house,to_vhv,relation,requested_by,requested_by_username,requested_by_name,requested_at,legacy_log_id)
   VALUES(p.person_id,trim(coalesce(p.title,'')||coalesce(p.fname,'')||' '||coalesce(p.lname,'')),trim(p.moo::text),trim(p.house),coalesce(p.vhv,'ไม่ระบุ'),NULL,d->>'toMoo',d->>'toHouse',coalesce(d->>'toVhv','ไม่ระบุ'),coalesce(d->>'relation','ผู้อาศัย'),u.id,u.username,coalesce(u.display_name,u.username),l.created_at,l.id) RETURNING id INTO new_id;
   INSERT INTO public.house_transfer_legacy_review(log_id,request_id,disposition) VALUES(l.id,new_id,'IMPORTED_REQUIRES_RESUBMIT');
  EXCEPTION WHEN OTHERS THEN
   INSERT INTO public.house_transfer_legacy_review(log_id,disposition) VALUES(l.id,'REVIEW_REQUIRED:'||SQLSTATE||':'||SQLERRM);
  END;
 END LOOP;
END $$;
-- Independent guard also protects imported rows whose source updated_at is NULL.
CREATE OR REPLACE FUNCTION app_private.block_legacy_transfer_approval() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD.legacy_log_id IS NOT NULL AND NEW.state='approved' AND OLD.state IS DISTINCT FROM NEW.state THEN
  RAISE EXCEPTION 'LEGACY_REQUEST_REQUIRES_RESUBMIT';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS block_legacy_transfer_approval ON public.house_transfer_requests;
CREATE TRIGGER block_legacy_transfer_approval BEFORE UPDATE ON public.house_transfer_requests FOR EACH ROW EXECUTE FUNCTION app_private.block_legacy_transfer_approval();
NOTIFY pgrst,'reload schema';
COMMIT;
