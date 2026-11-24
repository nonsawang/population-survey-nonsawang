-- Atomic RPC for admin/staff to merge a temporary web-added person (P-...) into
-- the real HOSxP person record, clean up dependent records, audit, and delete P-...
CREATE OR REPLACE FUNCTION public.merge_duplicate_new_person(
  p_dup_person_id text,
  p_target_person_id text,
  p_patch jsonb DEFAULT '{}'::jsonb,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  a jsonb := public.app_current_user();
  v_dup text := trim(coalesce(p_dup_person_id, ''));
  v_target text := trim(coalesce(p_target_person_id, ''));
  v_patch jsonb := CASE WHEN jsonb_typeof(p_patch) = 'object' THEN p_patch ELSE '{}'::jsonb END;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_lock_row record;
  v_has_dup boolean := false;
  v_has_target boolean := false;
  v_dup_name text := '';
  v_target_name text := '';
  v_dup_moo text := '';
  v_dup_house text := '';
  v_actor_id uuid;
  v_username text;
  v_details text;
BEGIN
  IF a IS NULL OR coalesce(a->>'role', '') NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF v_dup = '' OR v_target = '' OR length(v_dup) > 100 OR length(v_target) > 100
     OR v_dup NOT LIKE 'P-%' OR v_target LIKE 'P-%' OR v_dup = v_target THEN
    RAISE EXCEPTION 'INVALID_MERGE_IDS';
  END IF;

  -- Lock both rows in deterministic person_id order without triggering SQL Editor's RLS false positive.
  FOR v_lock_row IN
    SELECT *
      FROM public.population
     WHERE person_id IN (v_dup, v_target)
     ORDER BY person_id
     FOR UPDATE
  LOOP
    IF v_lock_row.person_id = v_dup THEN
      v_has_dup := true;
      v_dup_name := trim(coalesce(v_lock_row.title, '') || coalesce(v_lock_row.fname, '') || ' ' || coalesce(v_lock_row.lname, ''));
      v_dup_moo := coalesce(v_lock_row.moo, '');
      v_dup_house := coalesce(v_lock_row.house, '');
    ELSIF v_lock_row.person_id = v_target THEN
      v_has_target := true;
      v_target_name := trim(coalesce(v_lock_row.title, '') || coalesce(v_lock_row.fname, '') || ' ' || coalesce(v_lock_row.lname, ''));
    END IF;
  END LOOP;

  IF NOT v_has_dup THEN RAISE EXCEPTION 'DUP_NOT_FOUND'; END IF;
  IF NOT v_has_target THEN RAISE EXCEPTION 'TARGET_NOT_FOUND'; END IF;

  -- Update ONLY whitelisted survey/address/screening columns on target (never person_id, cid, title, fname, lname, discharge).
  UPDATE public.population
     SET residency_type       = CASE WHEN v_patch ? 'residency_type' THEN v_patch->>'residency_type' ELSE residency_type END,
         status_model_version = CASE WHEN v_patch ? 'status_model_version' THEN (v_patch->>'status_model_version')::integer ELSE status_model_version END,
         chronic              = CASE WHEN v_patch ? 'chronic' THEN v_patch->>'chronic' ELSE chronic END,
         relation             = CASE WHEN v_patch ? 'relation' THEN v_patch->>'relation' ELSE relation END,
         birth_date           = CASE WHEN v_patch ? 'birth_date' THEN nullif(v_patch->>'birth_date', '')::date ELSE birth_date END,
         moo                  = CASE WHEN v_patch ? 'moo' THEN v_patch->>'moo' ELSE moo END,
         house                = CASE WHEN v_patch ? 'house' THEN v_patch->>'house' ELSE house END,
         vhv                  = CASE WHEN v_patch ? 'vhv' THEN v_patch->>'vhv' ELSE vhv END,
         latitude             = CASE WHEN v_patch ? 'latitude' THEN (v_patch->>'latitude')::double precision ELSE latitude END,
         longitude            = CASE WHEN v_patch ? 'longitude' THEN (v_patch->>'longitude')::double precision ELSE longitude END,
         hep_screen           = CASE WHEN v_patch ? 'hep_screen' THEN v_patch->>'hep_screen' ELSE hep_screen END,
         hep_date             = CASE WHEN v_patch ? 'hep_date' THEN nullif(v_patch->>'hep_date', '')::date ELSE hep_date END,
         fobt_screen          = CASE WHEN v_patch ? 'fobt_screen' THEN v_patch->>'fobt_screen' ELSE fobt_screen END,
         fobt_date            = CASE WHEN v_patch ? 'fobt_date' THEN nullif(v_patch->>'fobt_date', '')::date ELSE fobt_date END,
         hpv_screen           = CASE WHEN v_patch ? 'hpv_screen' THEN v_patch->>'hpv_screen' ELSE hpv_screen END,
         hpv_date             = CASE WHEN v_patch ? 'hpv_date' THEN nullif(v_patch->>'hpv_date', '')::date ELSE hpv_date END,
         child_dev            = CASE WHEN v_patch ? 'child_dev' THEN v_patch->>'child_dev' ELSE child_dev END,
         child_date           = CASE WHEN v_patch ? 'child_date' THEN nullif(v_patch->>'child_date', '')::date ELSE child_date END,
         child_dev_date       = CASE WHEN v_patch ? 'child_dev_date' THEN nullif(v_patch->>'child_dev_date', '')::date ELSE child_dev_date END,
         smoking_status       = CASE WHEN v_patch ? 'smoking_status' THEN v_patch->>'smoking_status' ELSE smoking_status END,
         fagerstrom_score     = CASE WHEN v_patch ? 'fagerstrom_score' THEN (v_patch->>'fagerstrom_score')::integer ELSE fagerstrom_score END,
         fagerstrom_answers   = CASE WHEN v_patch ? 'fagerstrom_answers' THEN v_patch->>'fagerstrom_answers' ELSE fagerstrom_answers END,
         alcohol_status       = CASE WHEN v_patch ? 'alcohol_status' THEN v_patch->>'alcohol_status' ELSE alcohol_status END,
         assist_score         = CASE WHEN v_patch ? 'assist_score' THEN (v_patch->>'assist_score')::integer ELSE assist_score END,
         assist_answers       = CASE WHEN v_patch ? 'assist_answers' THEN v_patch->>'assist_answers' ELSE assist_answers END,
         adl_score            = CASE WHEN v_patch ? 'adl_score' THEN (v_patch->>'adl_score')::integer ELSE adl_score END,
         adl_answers          = CASE WHEN v_patch ? 'adl_answers' THEN v_patch->>'adl_answers' ELSE adl_answers END,
         ov_q1                = CASE WHEN v_patch ? 'ov_q1' THEN v_patch->>'ov_q1' ELSE ov_q1 END,
         ov_q2                = CASE WHEN v_patch ? 'ov_q2' THEN v_patch->>'ov_q2' ELSE ov_q2 END,
         ov_q3                = CASE WHEN v_patch ? 'ov_q3' THEN v_patch->>'ov_q3' ELSE ov_q3 END,
         ov_q4                = CASE WHEN v_patch ? 'ov_q4' THEN v_patch->>'ov_q4' ELSE ov_q4 END,
         ov_q5                = CASE WHEN v_patch ? 'ov_q5' THEN v_patch->>'ov_q5' ELSE ov_q5 END,
         ov_date              = CASE WHEN v_patch ? 'ov_date' THEN nullif(v_patch->>'ov_date', '')::date ELSE ov_date END,
         updated_at           = now()
   WHERE person_id = v_target;

  -- Clean up or migrate optional dependent tables before removing the duplicate P-... record.
  IF to_regclass('public.survey_person_reviews') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.survey_person_reviews WHERE person_id = $1' USING v_dup;
  END IF;

  IF to_regclass('public.annual_health_screenings_2570') IS NOT NULL THEN
    EXECUTE $q$
      UPDATE public.annual_health_screenings_2570 s
         SET person_id = $2,
             updated_at = now()
       WHERE s.person_id = $1
         AND NOT EXISTS (
           SELECT 1
             FROM public.annual_health_screenings_2570 t
            WHERE t.person_id = $2 AND t.fiscal_year = s.fiscal_year
         )
    $q$ USING v_dup, v_target;
    EXECUTE 'DELETE FROM public.annual_health_screenings_2570 WHERE person_id = $1' USING v_dup;
  END IF;

  IF to_regclass('public.house_transfer_requests') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.house_transfer_requests WHERE person_id = $1' USING v_dup;
  END IF;

  DELETE FROM public.population WHERE person_id = v_dup;

  BEGIN
    v_actor_id := nullif(trim(coalesce(a->>'userId', '')), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;
  v_username := coalesce(nullif(a->>'username', ''), nullif(a->>'displayName', ''), 'staff');
  v_details := format(
    'รวมข้อมูลและลบคนเพิ่มใหม่ %s (%s) เข้าสู่รหัส HOSxP %s (%s) บ้านเลขที่ %s ม.%s%s',
    v_dup_name,
    v_dup,
    v_target_name,
    v_target,
    coalesce(nullif(v_patch->>'house', ''), nullif(v_dup_house, ''), '-'),
    coalesce(nullif(v_patch->>'moo', ''), nullif(v_dup_moo, ''), '-'),
    CASE WHEN v_reason IS NOT NULL THEN ' • เหตุผล: ' || v_reason ELSE '' END
  );

  IF to_regclass('public.activity_logs') IS NOT NULL THEN
    INSERT INTO public.activity_logs(user_id, username, action, details, target_id)
    VALUES (v_actor_id, v_username, 'MERGE_NEW_PERSON', v_details, v_target);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'deletedPersonId', v_dup,
    'targetPersonId', v_target
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.merge_duplicate_new_person(text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_duplicate_new_person(text, text, jsonb, text) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
