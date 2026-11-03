-- Initialize Supabase-compatible roles and base tables for local facility PostgreSQL
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

GRANT anon, authenticated, service_role TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'vhv',
  moo text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login timestamptz,
  line_user_id text,
  avatar_url text
);

CREATE TABLE IF NOT EXISTS public.population (
  person_id text PRIMARY KEY,
  cid text,
  title text,
  fname text,
  lname text,
  birth_date date,
  house text,
  moo text,
  relation text,
  residency_type text,
  person_discharge_id integer DEFAULT 9,
  status_model_version integer DEFAULT 1,
  legacy_residency_type text,
  chronic text,
  vhv text,
  status text DEFAULT 'Active',
  latitude double precision,
  longitude double precision,
  hep_screen text,
  hep_date date,
  fobt_screen text,
  fobt_date date,
  hpv_screen text,
  hpv_date date,
  child_dev text,
  child_date date,
  child_dev_date date,
  smoking_status text,
  alcohol_status text,
  fagerstrom_score integer,
  assist_score integer,
  fagerstrom_answers text,
  assist_answers text,
  adl_score integer,
  adl_answers text,
  ov_q1 text,
  ov_q2 text,
  ov_q3 text,
  ov_q4 text,
  ov_q5 text,
  ov_date date,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vhv_data (
  id serial PRIMARY KEY,
  name text NOT NULL,
  moo text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id bigserial PRIMARY KEY,
  user_id uuid,
  username text,
  action text,
  details text,
  target_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
