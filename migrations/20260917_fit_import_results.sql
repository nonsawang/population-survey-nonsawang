-- Separate immutable preparation from the LAN connector's verified outcome.
BEGIN;
CREATE TABLE public.hosxp_fit_import_results (
 preparation_id uuid PRIMARY KEY REFERENCES public.hosxp_fit_preparations(id),
 vn text NOT NULL UNIQUE CHECK(vn ~ '^[0-9]{12,13}$'),
 lab_order_number bigint NOT NULL,
 imported_at timestamptz NOT NULL,
 verified_at timestamptz NOT NULL,
 policy_version text NOT NULL CHECK(policy_version='fit-visit-20260917'),
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
 import_status text NOT NULL CHECK(import_status='imported'),
 claim_status text NOT NULL DEFAULT 'not_ready' CHECK(claim_status IN ('not_ready','ready')),
 claim_checks jsonb NOT NULL,
 CHECK(claim_status<>'ready' OR
   (claim_checks @> '{"mapping":true,"auth":true,"invoice":true,"export_verified":true}'::jsonb))
);
ALTER TABLE public.hosxp_fit_import_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hosxp_fit_import_results FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.hosxp_fit_import_results TO service_role;

CREATE FUNCTION public.hosxp_fit_import_status(p_history uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor jsonb:=public.app_current_user(); result jsonb;
BEGIN
 IF coalesce(actor->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
 SELECT jsonb_build_object('preparation_id',p.id,'import_status',coalesce(r.import_status,'pending'),
 'vn',r.vn,'lab_order_number',r.lab_order_number,'imported_at',r.imported_at,'verified_at',r.verified_at,
 'claim_status',coalesce(r.claim_status,'not_ready'),'claim_checks',coalesce(r.claim_checks,'{}'::jsonb))
 INTO result FROM public.hosxp_fit_preparations p
 LEFT JOIN public.hosxp_fit_import_results r ON r.preparation_id=p.id WHERE p.history_id=p_history;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.hosxp_fit_import_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hosxp_fit_import_status(uuid) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
