BEGIN;
-- Add billing metadata for new preparations without rewriting immutable old payloads.
DO $migration$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('public.hosxp_fit_preview(uuid)'::regprocedure);
 IF position('billing_mapping_version' in definition)=0 THEN
  IF position('''mapping_version'',''fit-20260914''' in definition)=0 THEN RAISE EXCEPTION 'UNEXPECTED_FIT_PREVIEW'; END IF;
  EXECUTE replace(definition,'''mapping_version'',''fit-20260914''',
   '''billing_mapping_version'',''fit-billing-20260922'',''income_code'',''07'',''bill_code'',''31209'',''adp_type'',15,''adp_code'',''31209'',''fee_quantity'',1,''fee_price'',60,''pp_special_code'',CASE h.result WHEN ''ปกติ'' THEN ''1B0060'' ELSE ''1B0061'' END,''mapping_version'',''fit-20260914''');
 END IF;
END $migration$;
NOTIFY pgrst,'reload schema';
COMMIT;
