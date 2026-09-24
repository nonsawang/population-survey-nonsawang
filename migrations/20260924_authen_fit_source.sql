BEGIN;
ALTER TABLE public.authen_report_writes ALTER COLUMN vn DROP NOT NULL;
CREATE OR REPLACE FUNCTION public.authen_report_accept(p_id uuid,p_items jsonb,p_confirm_report boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a jsonb:=public.app_current_user(); b public.authen_report_batches%ROWTYPE; item jsonb; found_row jsonb; accepted jsonb;
BEGIN
 IF coalesce(a->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
 IF p_confirm_report IS DISTINCT FROM true OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
 OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'REPORT_CONFIRM_REQUIRED'; END IF;
 SELECT * INTO b FROM public.authen_report_batches WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR b.state<>'matched' OR b.checked_at IS NULL OR b.checked_at<now()-interval '24 hours' THEN RAISE EXCEPTION 'REPORT_REFRESH_REQUIRED'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  SELECT value INTO found_row FROM jsonb_array_elements(b.results) WHERE value->>'row'=item->>'row';
  IF found_row IS NULL OR found_row->>'matchVersion' IS DISTINCT FROM 'fit-source-v1' OR found_row->>'fitPreparationId' IS NULL OR found_row->>'status' NOT IN ('matched','already_present')
   OR found_row->>'fingerprint' IS DISTINCT FROM item->>'fingerprint' THEN RAISE EXCEPTION 'REPORT_CHANGED'; END IF;
  INSERT INTO public.authen_report_writes(batch_id,row_number,vn,fingerprint,approved_by)
  VALUES(p_id,(item->>'row')::integer,found_row->>'vn',found_row->>'fingerprint',(a->>'userId')::uuid)
  ON CONFLICT(batch_id,row_number) DO NOTHING;
 END LOOP;
 SELECT jsonb_agg(n) INTO accepted FROM (SELECT DISTINCT value AS n FROM jsonb_array_elements(b.approved_rows || (SELECT jsonb_agg(value->'row') FROM jsonb_array_elements(p_items))))q;
 UPDATE public.authen_report_batches SET approved_rows=accepted,approved_by=(a->>'userId')::uuid,approved_at=now() WHERE id=p_id;
 INSERT INTO public.activity_logs(user_id,username,action,details,target_id)
 VALUES((a->>'userId')::uuid,a->>'username','AUTHEN_REPORT_ACCEPT','อนุมัติคิวบันทึก Authen ผ่าน LAN: '||p_items::text,p_id::text);
 RETURN jsonb_build_object('accepted',jsonb_array_length(accepted),'hosxp_written',false);
END $$;

UPDATE public.authen_report_batches SET state='pending',results='[]',checked_at=NULL WHERE approved_rows='[]'::jsonb;
CREATE OR REPLACE FUNCTION public.authen_report_list(p_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a jsonb:=public.app_current_user(); result jsonb;
BEGIN
 IF coalesce(a->>'role','') NOT IN ('staff','admin') THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
 IF p_id IS NULL THEN
  SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') INTO result FROM
   (SELECT id,uploaded_at,state,jsonb_array_length(rows) AS row_count,checked_at,error_code FROM public.authen_report_batches ORDER BY uploaded_at DESC LIMIT 20)t;
 ELSE
  SELECT jsonb_build_object('id',id,'state',state,'uploaded_at',uploaded_at,'rows',rows,'results',results,'checked_at',checked_at,
   'error_code',error_code,'approved_rows',approved_rows,'approved_at',approved_at,
   'writes',coalesce((SELECT jsonb_agg(jsonb_build_object('row',w.row_number,'vn',w.vn,'state',w.state,'completed_at',w.completed_at,'error_code',w.error_code)) FROM public.authen_report_writes w WHERE w.batch_id=p_id),'[]'::jsonb))
   INTO result FROM public.authen_report_batches WHERE id=p_id;
 END IF;
 RETURN result;
END $$;


NOTIFY pgrst,'reload schema';
COMMIT;
