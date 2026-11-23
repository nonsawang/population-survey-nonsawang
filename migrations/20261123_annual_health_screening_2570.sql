-- ระบบคัดกรองภาวะสุขภาพประจำปีงบประมาณ 2570 รพ.สต.บ้านโนนสว่าง (ครบ 22 หมวด)
BEGIN;

CREATE TABLE IF NOT EXISTS public.annual_health_screenings_2570 (
  person_id text NOT NULL,
  fiscal_year integer NOT NULL DEFAULT 2570,
  screen_date date NOT NULL DEFAULT current_date,
  form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  pp_special_codes text[] NOT NULL DEFAULT '{}'::text[],
  overall_status text NOT NULL DEFAULT 'ปกติ',
  risk_count integer NOT NULL DEFAULT 0,
  bmi numeric(5, 1),
  recorded_by text,
  recorded_role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS annual_health_screenings_2570_date_idx
  ON public.annual_health_screenings_2570 (fiscal_year, screen_date DESC);

ALTER TABLE public.annual_health_screenings_2570 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.annual_health_screenings_2570 FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.annual_health_screenings_2570 TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
