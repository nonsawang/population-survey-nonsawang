BEGIN;
ALTER TABLE public.house_transfer_requests ADD COLUMN IF NOT EXISTS legacy_log_id bigint UNIQUE;
CREATE OR REPLACE FUNCTION app_private.valid_moo(p_moo text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT trim(coalesce(p_moo, '')) IN ('1','2','3','4','5','6','7','8','14','18','19','20','21','22','23');
$$;
CREATE OR REPLACE FUNCTION public.house_transfer_submit(
  p_person_id text,
  p_expected_moo text,
  p_expected_house text,
  p_target_moo text,
  p_target_house text,
  p_target_vhv text DEFAULT NULL,
  p_relation text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  a jsonb := public.app_current_user();
  p public.population%ROWTYPE;
  v_from_moo text;
  v_from_house text;
  v_target_moo text := trim(coalesce(p_target_moo, ''));
  v_target_house text := trim(coalesce(p_target_house, ''));
  v_req_vhv text := trim(coalesce(p_target_vhv, ''));
  v_house_vhv text := '';
  v_resolved_vhv text;
  v_lat double precision := NULL;
  v_lng double precision := NULL;
  v_relation text;
  v_fullname text;
  v_immediate boolean;
  v_req public.house_transfer_requests%ROWTYPE;
BEGIN
  IF a IS NULL OR coalesce(a->>'role', '') NOT IN ('admin', 'staff', 'vhv') THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE';
  END IF;

  IF p_person_id IS NULL OR trim(p_person_id) = '' OR length(p_person_id) > 100 THEN
    RAISE EXCEPTION 'PERSON_NOT_FOUND';
  END IF;

  IF NOT app_private.valid_moo(v_target_moo) OR v_target_house = '' OR length(v_target_house) > 50 THEN
    RAISE EXCEPTION 'INVALID_TARGET_HOUSE';
  END IF;

  SELECT * INTO p
  FROM public.population
  WHERE person_id = trim(p_person_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PERSON_NOT_FOUND';
  END IF;

  v_from_moo := trim(coalesce(p.moo::text, ''));
  v_from_house := trim(coalesce(p.house, ''));

  IF NOT app_private.transfer_in_scope(v_from_moo) THEN
    RAISE EXCEPTION 'FORBIDDEN_SOURCE_MOO';
  END IF;

  IF nullif(trim(coalesce(p_expected_moo, '')), '') IS NOT NULL AND trim(p_expected_moo) <> v_from_moo THEN
    RAISE EXCEPTION 'SOURCE_PERSON_CHANGED';
  END IF;

  IF nullif(trim(coalesce(p_expected_house, '')), '') IS NOT NULL AND trim(p_expected_house) <> v_from_house THEN
    RAISE EXCEPTION 'SOURCE_PERSON_CHANGED';
  END IF;

  IF v_from_moo = v_target_moo AND v_from_house = v_target_house THEN
    RAISE EXCEPTION 'SAME_HOUSE';
  END IF;

  -- Require that the destination house already exists in public.population
  IF NOT EXISTS (
    SELECT 1 FROM public.population
    WHERE trim(moo::text) = v_target_moo AND trim(house) = v_target_house
  ) THEN
    RAISE EXCEPTION 'TARGET_HOUSE_NOT_FOUND';
  END IF;

  SELECT coalesce(trim(vhv), '') INTO v_house_vhv
  FROM public.population
  WHERE trim(moo::text) = v_target_moo
    AND trim(house) = v_target_house
    AND vhv IS NOT NULL
    AND trim(vhv) NOT IN ('', '-', 'ไม่ระบุ')
  ORDER BY person_id
  LIMIT 1;

  SELECT latitude, longitude INTO v_lat, v_lng
  FROM public.population
  WHERE trim(moo::text) = v_target_moo
    AND trim(house) = v_target_house
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
  ORDER BY person_id
  LIMIT 1;

  IF v_req_vhv <> '' AND v_req_vhv <> 'ไม่ระบุ' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vhv_data
      WHERE trim(moo::text) = v_target_moo AND trim(name) = v_req_vhv
    ) THEN
      RAISE EXCEPTION 'INVALID_TARGET_VHV';
    END IF;
    v_resolved_vhv := v_req_vhv;
  ELSE
    v_resolved_vhv := coalesce(nullif(v_house_vhv, ''), 'ไม่ระบุ');
  END IF;

  IF v_resolved_vhv <> 'ไม่ระบุ' AND NOT EXISTS (SELECT 1 FROM public.vhv_data WHERE trim(moo::text)=v_target_moo AND trim(name)=v_resolved_vhv) THEN
    RAISE EXCEPTION 'INVALID_TARGET_VHV';
  END IF;
  v_relation := coalesce(
    nullif(trim(coalesce(p_relation, '')), ''),
    nullif(trim(coalesce(p.relation, '')), ''),
    'ผู้อาศัย'
  );
  IF v_relation NOT IN ('เจ้าบ้าน', 'ผู้อาศัย', 'บิดา/มารดา', 'เขย/สะใภ้', 'บุตร/หลาน', 'หลาน', 'เช่าอาศัย', 'อื่นๆ', 'ไม่ระบุ') THEN
    RAISE EXCEPTION 'INVALID_RELATION';
  END IF;

  v_fullname := trim(coalesce(p.title, '') || coalesce(p.fname, '') || ' ' || coalesce(p.lname, ''));
  v_immediate := (a->>'role' IN ('admin', 'staff')) OR app_private.transfer_in_scope(v_target_moo);

  -- Supersede any existing pending request for this person within the same transaction
  UPDATE public.house_transfer_requests
  SET state = 'superseded',
      resolved_by = (a->>'userId')::uuid,
      resolved_by_username = a->>'username',
      resolved_by_name = coalesce(a->>'displayName', a->>'username'),
      resolved_at = now(),
      resolution_reason = CASE WHEN v_immediate THEN 'ย้ายเข้าบ้านปลายทางทันที' ELSE 'แทนที่ด้วยคำขอย้ายบ้านใหม่' END
  WHERE person_id = p.person_id AND state = 'pending';

  IF v_immediate THEN
    UPDATE public.population
    SET moo = v_target_moo,
        house = v_target_house,
        vhv = v_resolved_vhv,
        latitude = v_lat,
        longitude = v_lng,
        relation = v_relation,
        updated_at = now()
    WHERE person_id = p.person_id;

    INSERT INTO public.activity_logs(user_id, username, action, details, target_id)
    VALUES (
      (a->>'userId')::uuid,
      a->>'username',
      'MOVE_HOUSE',
      format(
        'ย้าย %s จากบ้านเลขที่ %s ม.%s ไปบ้านเลขที่ %s ม.%s (อสม. %s) [เฉพาะทะเบียนสำรวจ ยังไม่เปลี่ยน HOSxP]',
        v_fullname, v_from_house, v_from_moo, v_target_house, v_target_moo, v_resolved_vhv
      ),
      p.person_id
    );

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'moved_immediately',
      'hosxpSynced', false,
      'personId', p.person_id,
      'toMoo', v_target_moo,
      'toHouse', v_target_house,
      'toVhv', v_resolved_vhv
    );
  END IF;

  INSERT INTO public.house_transfer_requests(
    person_id, fullname, from_moo, from_house, from_vhv, source_updated_at,
    to_moo, to_house, to_vhv, relation, state,
    requested_by, requested_by_username, requested_by_name
  ) VALUES (
    p.person_id,
    v_fullname,
    v_from_moo,
    v_from_house,
    coalesce(nullif(trim(coalesce(p.vhv, '')), ''), 'ไม่ระบุ'),
    p.updated_at,
    v_target_moo,
    v_target_house,
    v_resolved_vhv,
    v_relation,
    'pending',
    (a->>'userId')::uuid,
    a->>'username',
    coalesce(a->>'displayName', a->>'username')
  ) RETURNING * INTO v_req;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'pending_approval',
    'hosxpSynced', false,
    'requestId', v_req.id,
    'personId', v_req.person_id,
    'toMoo', v_req.to_moo,
    'toHouse', v_req.to_house,
    'toVhv', v_req.to_vhv
  );
END $$;
CREATE OR REPLACE FUNCTION public.house_transfer_approve(
  p_request_id bigint,
  p_to_vhv text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  a jsonb := public.app_current_user();
  req public.house_transfer_requests%ROWTYPE;
  p public.population%ROWTYPE;
  v_req_vhv text := trim(coalesce(p_to_vhv, ''));
  v_house_vhv text := '';
  v_final_vhv text;
  v_lat double precision := NULL;
  v_lng double precision := NULL;
BEGIN
  IF a IS NULL OR coalesce(a->>'role', '') NOT IN ('admin', 'staff', 'vhv') THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE';
  END IF;

  IF p_request_id IS NULL OR p_request_id <= 0 THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  SELECT * INTO req
  FROM public.house_transfer_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  IF req.state <> 'pending' THEN
    RAISE EXCEPTION 'REQUEST_NOT_PENDING';
  END IF;

  IF NOT app_private.transfer_in_scope(req.to_moo) THEN
    RAISE EXCEPTION 'FORBIDDEN_TARGET_MOO';
  END IF;

  SELECT * INTO p
  FROM public.population
  WHERE person_id = req.person_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PERSON_NOT_FOUND';
  END IF;

  -- Same lock order as submit: person first, then request. Recheck after waiting.
  SELECT * INTO req FROM public.house_transfer_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
  IF req.state <> 'pending' THEN RAISE EXCEPTION 'REQUEST_NOT_PENDING'; END IF;
  IF NOT app_private.transfer_in_scope(req.to_moo) THEN RAISE EXCEPTION 'FORBIDDEN_TARGET_MOO'; END IF;
  IF req.legacy_log_id IS NOT NULL THEN RAISE EXCEPTION 'LEGACY_REQUEST_REQUIRES_RESUBMIT'; END IF;
  -- Guard against stale request overwriting newer moves or edits
  IF trim(coalesce(p.moo::text, '')) <> req.from_moo
     OR trim(coalesce(p.house, '')) <> req.from_house
     OR p.updated_at IS DISTINCT FROM req.source_updated_at THEN
    RAISE EXCEPTION 'SOURCE_PERSON_CHANGED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.population
    WHERE trim(moo::text) = req.to_moo AND trim(house) = req.to_house
  ) THEN
    RAISE EXCEPTION 'TARGET_HOUSE_NOT_FOUND';
  END IF;

  SELECT coalesce(trim(vhv), '') INTO v_house_vhv
  FROM public.population
  WHERE trim(moo::text) = req.to_moo
    AND trim(house) = req.to_house
    AND vhv IS NOT NULL
    AND trim(vhv) NOT IN ('', '-', 'ไม่ระบุ')
  ORDER BY person_id
  LIMIT 1;

  SELECT latitude, longitude INTO v_lat, v_lng
  FROM public.population
  WHERE trim(moo::text) = req.to_moo
    AND trim(house) = req.to_house
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
  ORDER BY person_id
  LIMIT 1;

  IF v_req_vhv = '' THEN
    v_req_vhv := trim(coalesce(req.to_vhv, ''));
  END IF;

  IF v_req_vhv <> '' AND v_req_vhv <> 'ไม่ระบุ' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vhv_data
      WHERE trim(moo::text) = req.to_moo AND trim(name) = v_req_vhv
    ) THEN
      RAISE EXCEPTION 'INVALID_TARGET_VHV';
    END IF;
    v_final_vhv := v_req_vhv;
  ELSE
    v_final_vhv := coalesce(nullif(v_house_vhv, ''), 'ไม่ระบุ');
  END IF;

  IF v_final_vhv <> 'ไม่ระบุ' AND NOT EXISTS (SELECT 1 FROM public.vhv_data WHERE trim(moo::text)=req.to_moo AND trim(name)=v_final_vhv) THEN
    RAISE EXCEPTION 'INVALID_TARGET_VHV';
  END IF;
  UPDATE public.population
  SET moo = req.to_moo,
      house = req.to_house,
      vhv = v_final_vhv,
      latitude = v_lat,
      longitude = v_lng,
      relation = req.relation,
      updated_at = now()
  WHERE person_id = req.person_id;

  UPDATE public.house_transfer_requests
  SET state = 'approved',
      to_vhv = v_final_vhv,
      resolved_by = (a->>'userId')::uuid,
      resolved_by_username = a->>'username',
      resolved_by_name = coalesce(a->>'displayName', a->>'username'),
      resolved_at = now(),
      resolution_reason = 'อนุมัติรับเข้าบ้านปลายทาง'
  WHERE id = req.id;

  INSERT INTO public.activity_logs(user_id, username, action, details, target_id)
  VALUES (
    (a->>'userId')::uuid,
    a->>'username',
    'MOVE_HOUSE',
    format(
      'อนุมัติย้ายข้ามหมู่: %s จากบ้านเลขที่ %s ม.%s -> บ้านเลขที่ %s ม.%s (อสม. %s | ยืนยันโดย %s) [เฉพาะทะเบียนสำรวจ ยังไม่เปลี่ยน HOSxP]',
      req.fullname, req.from_house, req.from_moo, req.to_house, req.to_moo, v_final_vhv, coalesce(a->>'displayName', a->>'username')
    ),
    req.person_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'approved',
    'hosxpSynced', false,
    'requestId', req.id,
    'personId', req.person_id,
    'fullname', req.fullname,
    'toMoo', req.to_moo,
    'toHouse', req.to_house,
    'toVhv', v_final_vhv
  );
END $$;
CREATE OR REPLACE FUNCTION public.house_transfer_list(
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  a jsonb := public.app_current_user();
  v_page integer := GREATEST(coalesce(p_page, 1), 1);
  v_size integer := LEAST(GREATEST(coalesce(p_page_size, 20), 1), 50);
  v_offset integer := (v_page - 1) * v_size;
  v_inc_total integer := 0;
  v_out_total integer := 0;
  v_incoming jsonb := '[]'::jsonb;
  v_outgoing jsonb := '[]'::jsonb;
  v_lookup jsonb := '[]'::jsonb;
  v_vhv_by_moo jsonb := '{}'::jsonb;
BEGIN
  IF a IS NULL OR coalesce(a->>'role', '') NOT IN ('admin', 'staff', 'vhv') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'page', v_page,
      'pageSize', v_size,
      'incomingTotal', 0,
      'outgoingTotal', 0,
      'incoming', '[]'::jsonb,
      'outgoing', '[]'::jsonb,
      'allPendingForLookup', '[]'::jsonb,
      'vhvByMoo', '{}'::jsonb
    );
  END IF;

  SELECT count(*)::int INTO v_inc_total
  FROM public.house_transfer_requests r
  WHERE r.state = 'pending' AND app_private.transfer_in_scope(r.to_moo);

  SELECT coalesce(jsonb_agg(item), '[]'::jsonb) INTO v_incoming
  FROM (
    SELECT jsonb_build_object(
      'requestId', r.id,
      'legacyNeedsReview', r.legacy_log_id IS NOT NULL,
      'personId', r.person_id,
      'fullname', r.fullname,
      'fromMoo', r.from_moo,
      'fromHouse', r.from_house,
      'fromVhv', r.from_vhv,
      'toMoo', r.to_moo,
      'toHouse', r.to_house,
      'toVhv', r.to_vhv,
      'relation', r.relation,
      'requestedBy', r.requested_by_username,
      'requestedByName', r.requested_by_name,
      'requestedAt', r.requested_at,
      'canApprove', true,
      'canCancel', true
    ) AS item
    FROM public.house_transfer_requests r
    WHERE r.state = 'pending' AND app_private.transfer_in_scope(r.to_moo)
    ORDER BY r.requested_at ASC, r.id ASC
    LIMIT v_size OFFSET v_offset
  ) sub;

  IF a->>'role' = 'vhv' THEN
    SELECT count(*)::int INTO v_out_total
    FROM public.house_transfer_requests r
    WHERE r.state = 'pending'
      AND app_private.transfer_in_scope(r.from_moo)
      AND NOT app_private.transfer_in_scope(r.to_moo);

    SELECT coalesce(jsonb_agg(item), '[]'::jsonb) INTO v_outgoing
    FROM (
      SELECT jsonb_build_object(
        'requestId', r.id,
      'legacyNeedsReview', r.legacy_log_id IS NOT NULL,
        'personId', r.person_id,
        'fullname', r.fullname,
        'fromMoo', r.from_moo,
        'fromHouse', r.from_house,
        'fromVhv', r.from_vhv,
        'toMoo', r.to_moo,
        'toHouse', r.to_house,
        'toVhv', r.to_vhv,
        'relation', r.relation,
        'requestedBy', r.requested_by_username,
        'requestedByName', r.requested_by_name,
        'requestedAt', r.requested_at,
        'canApprove', false,
        'canCancel', true
      ) AS item
      FROM public.house_transfer_requests r
      WHERE r.state = 'pending'
        AND app_private.transfer_in_scope(r.from_moo)
        AND NOT app_private.transfer_in_scope(r.to_moo)
      ORDER BY r.requested_at ASC, r.id ASC
      LIMIT v_size OFFSET v_offset
    ) sub;
  END IF;

  SELECT coalesce(jsonb_agg(item), '[]'::jsonb) INTO v_lookup
  FROM (
    SELECT jsonb_build_object(
      'requestId', r.id,
      'legacyNeedsReview', r.legacy_log_id IS NOT NULL,
      'personId', r.person_id,
      'fullname', r.fullname,
      'fromMoo', r.from_moo,
      'fromHouse', r.from_house,
      'toMoo', r.to_moo,
      'toHouse', r.to_house,
      'toVhv', r.to_vhv,
      'relation', r.relation,
      'requestedBy', r.requested_by_username,
      'requestedByName', r.requested_by_name,
      'requestedAt', r.requested_at
    ) AS item
    FROM public.house_transfer_requests r
    WHERE r.state = 'pending'
      AND (app_private.transfer_in_scope(r.from_moo) OR app_private.transfer_in_scope(r.to_moo))
    ORDER BY r.requested_at ASC, r.id ASC
  ) sub;

  SELECT coalesce(jsonb_object_agg(moo_key, names), '{}'::jsonb) INTO v_vhv_by_moo
  FROM (
    SELECT trim(moo::text) AS moo_key,
           jsonb_agg( DISTINCT trim(name) ORDER BY trim(name) ) AS names
    FROM public.vhv_data
    WHERE trim(coalesce(name, '')) <> ''
      AND app_private.transfer_in_scope(trim(moo::text))
    GROUP BY trim(moo::text)
  ) sub;

  RETURN jsonb_build_object(
    'ok', true,
    'page', v_page,
    'pageSize', v_size,
    'incomingTotal', v_inc_total,
    'outgoingTotal', v_out_total,
    'incoming', v_incoming,
    'outgoing', v_outgoing,
    'allPendingForLookup', v_lookup,
    'vhvByMoo', v_vhv_by_moo
  );
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
