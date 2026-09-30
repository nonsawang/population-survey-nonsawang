-- Read-only. Run in the NEW TEST PROJECT after schema-only restore.
-- Check the project name/ref in Dashboard first. This does not seed data.
SELECT n.nspname AS schema_name,c.relname AS table_name,c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','app_private') AND c.relkind='r'
ORDER BY 1,2;

SELECT proname,pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname IN
 ('app_auth_password','app_current_user','app_logout','screening_search',
  'screening_history_list','screening_review_approve','hosxp_fit_prepare',
  'authen_report_accept','person_identity_request')
ORDER BY 1;

SELECT schemaname,tablename,policyname,roles,cmd
FROM pg_policies WHERE schemaname IN ('public','app_private') ORDER BY 1,2,3;

SELECT extname,extversion FROM pg_extension ORDER BY extname;

-- Accurate counts without displaying personal records. Before synthetic seed,
-- every application table should be empty after a schema-only restore.
DO $$ DECLARE r record; row_count bigint; BEGIN
 FOR r IN SELECT schemaname,tablename FROM pg_tables
          WHERE schemaname IN ('public','app_private') ORDER BY 1,2 LOOP
  EXECUTE format('SELECT count(*) FROM %I.%I',r.schemaname,r.tablename) INTO row_count;
  RAISE NOTICE '%.%: % rows',r.schemaname,r.tablename,row_count;
 END LOOP;
END $$;
