BEGIN;
CREATE TABLE public.nhso_close_permissions (
 user_id uuid PRIMARY KEY REFERENCES public.app_users(id),
 enabled boolean NOT NULL DEFAULT false,
 granted_at timestamptz NOT NULL DEFAULT now(),
 granted_by uuid REFERENCES public.app_users(id)
);
ALTER TABLE public.nhso_close_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nhso_close_permissions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.nhso_close_permissions TO service_role;
CREATE FUNCTION public.nhso_close_allowed() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.nhso_close_permissions p JOIN public.app_users u ON u.id=p.user_id
  WHERE p.user_id=(public.app_current_user()->>'userId')::uuid
  AND p.enabled AND u.is_active AND u.role IN ('staff','admin')
 );
$$;
REVOKE ALL ON FUNCTION public.nhso_close_allowed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nhso_close_allowed() TO anon,authenticated;
-- No automatic grants: named accounts must be explicitly approved.
NOTIFY pgrst,'reload schema';
COMMIT;
