BEGIN;
ALTER TABLE public.house_gps_queue ADD COLUMN approved_by text, ADD COLUMN approved_at timestamptz;
CREATE FUNCTION public.house_gps_approve(p_id uuid,p_lat double precision,p_lng double precision) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a jsonb:=public.app_current_user(); q record;
BEGIN
 SELECT * INTO q FROM public.house_gps_queue WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF a->>'userId' IS NULL OR coalesce(a->>'role','') NOT IN ('staff','admin') OR NOT coalesce(app_private.in_scope(q.moo),false) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF q.state<>'pending' THEN RAISE EXCEPTION 'REVISION_STATE_CHANGED'; END IF;
 IF q.latitude IS DISTINCT FROM p_lat OR q.longitude IS DISTINCT FROM p_lng THEN RAISE EXCEPTION 'GPS_REFERENCE_CHANGED'; END IF;
 UPDATE public.house_gps_queue SET approved_by=coalesce(approved_by,a->>'userId'),approved_at=coalesce(approved_at,now()) WHERE id=p_id;
 RETURN jsonb_build_object('id',p_id,'state','pending','approved',true);
END $$;
CREATE OR REPLACE FUNCTION public.house_gps_claim(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q record; BEGIN
 UPDATE public.house_gps_queue SET state='processing' WHERE id=p_id AND state='pending' AND approved_at IS NOT NULL AND approved_by IS NOT NULL RETURNING * INTO q;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_APPROVED_OR_NOT_PENDING'; END IF;
 RETURN to_jsonb(q);
END $$;
REVOKE ALL ON FUNCTION public.house_gps_approve(uuid,double precision,double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.house_gps_approve(uuid,double precision,double precision) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
