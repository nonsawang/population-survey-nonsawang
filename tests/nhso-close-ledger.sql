-- Run only on an isolated test database after installing the migration.
BEGIN;
DO $$
DECLARE a jsonb;b jsonb; owner uuid:=gen_random_uuid(); visit text:='fixture-'||gen_random_uuid()::text;
BEGIN
 a:=public.nhso_close_reserve('test','05080',visit,'fixture',repeat('a',64),owner);
 IF (a->>'acquired')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'FIRST_RESERVATION_FAILED'; END IF;
 b:=public.nhso_close_reserve('test','05080',visit,'fixture',repeat('a',64),gen_random_uuid());
 IF (b->>'acquired')::boolean IS DISTINCT FROM false OR b->>'transactionId' IS DISTINCT FROM a->>'transactionId' THEN RAISE EXCEPTION 'DUPLICATE_RESERVATION'; END IF;
 BEGIN
  PERFORM public.nhso_close_reserve('test','05080',visit,'fixture',repeat('b',64),owner);
  RAISE EXCEPTION 'EXPECTED_PAYLOAD_CONFLICT';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'CLOSE_PAYLOAD_CHANGED' THEN RAISE; END IF; END;
 PERFORM public.nhso_close_record((a->>'id')::uuid,owner,'outcome_unknown');
 b:=public.nhso_close_reserve('test','05080',visit,'fixture',repeat('a',64),owner);
 IF (b->>'acquired')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'UNSAFE_RETRY'; END IF;
 PERFORM public.nhso_close_record((a->>'id')::uuid,owner,'confirmed','fixture-seq','fixture-code');
 PERFORM public.nhso_close_record((a->>'id')::uuid,owner,'confirmed','fixture-seq','fixture-code');
END $$;
ROLLBACK;
