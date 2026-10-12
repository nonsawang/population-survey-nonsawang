BEGIN;
CREATE TABLE public.fit_auth_writeback_queue (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 closure_id uuid NOT NULL UNIQUE REFERENCES public.nhso_close_submissions(id),
 preparation_id uuid NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','written')),
 created_at timestamptz NOT NULL DEFAULT now(),
 written_at timestamptz
);
ALTER TABLE public.fit_auth_writeback_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fit_auth_writeback_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.fit_auth_writeback_queue TO service_role;
GRANT UPDATE(state,written_at) ON public.fit_auth_writeback_queue TO service_role;
COMMIT;
