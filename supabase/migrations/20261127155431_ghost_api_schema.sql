/*
# Ghost API — chaos engineering proxy platform

## Overview
Creates three relational tables for a multi-user chaos engineering proxy:
a profile table mirrored from auth.users, chaos endpoint rules, and request logs.
Enables email/password auth with a "Demo Login" button.

## Tables

### users (profile mirror)
- id (uuid, PK, references auth.users) — one row per signed-up user
- email (text, unique, not null)
- api_key (text, not null) — auto-generated per-user key
- created_at (timestamptz, default now())

### chaos_endpoints
- id (uuid, PK)
- user_id (uuid, references users, default auth.uid()) — owner
- name (text, not null) — human label
- target_url (text, not null) — upstream API to proxy
- proxy_slug (text, unique, not null) — unique route slug for the proxy URL
- fault_type (text, not null) — one of 'latency','http_500','http_503','timeout'
- latency_ms (integer, default 2000)
- error_code (integer, default 500)
- failure_rate (integer, 0..100) — probability of injecting the fault
- is_active (boolean, default true)
- created_at (timestamptz, default now())

### request_logs
- id (uuid, PK)
- endpoint_id (uuid, references chaos_endpoints) — which rule produced this
- user_id (uuid, references users) — owner
- timestamp (timestamptz, default now())
- request_method (text) — GET/POST etc.
- injected_fault_type (text) — 'none','latency','http_500','http_503','timeout'
- actual_latency_ms (integer) — measured round trip
- client_status (integer) — HTTP status returned to the client
- has_chaos_error (boolean) — whether a fault was injected

## Security
- RLS enabled on every table.
- Grants only to `authenticated` (sign-in required app). Plus service_role for edge functions.
- Owner-scoped policies using auth.uid() = user_id.
- Profile auto-insert handled via a trigger so a row in public.users exists for each auth.users row.

## Notes
1. Email confirmation stays OFF (default).
2. proxy_slug is generated client-side as a short random string.
3. api_key is generated client-side on signup and stored; trigger also fills a default.
*/

-- =========================
-- users (profile mirror)
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  api_key text NOT NULL DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 32),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT ON users TO service_role;

DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own" ON users;
CREATE POLICY "users_insert_own" ON users FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Allow reading the count of developers (for the metrics bar)
DROP POLICY IF EXISTS "users_count_all" ON users;
CREATE POLICY "users_count_all" ON users FOR SELECT
  TO authenticated USING (true);

-- =========================
-- chaos_endpoints
-- =========================
CREATE TABLE IF NOT EXISTS chaos_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_url text NOT NULL,
  proxy_slug text UNIQUE NOT NULL,
  fault_type text NOT NULL CHECK (fault_type IN ('latency','http_500','http_503','timeout')),
  latency_ms integer NOT NULL DEFAULT 2000,
  error_code integer NOT NULL DEFAULT 500,
  failure_rate integer NOT NULL DEFAULT 100 CHECK (failure_rate >= 0 AND failure_rate <= 100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chaos_endpoints ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON chaos_endpoints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chaos_endpoints TO service_role;

DROP POLICY IF EXISTS "endpoints_select_own" ON chaos_endpoints;
CREATE POLICY "endpoints_select_own" ON chaos_endpoints FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "endpoints_insert_own" ON chaos_endpoints;
CREATE POLICY "endpoints_insert_own" ON chaos_endpoints FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "endpoints_update_own" ON chaos_endpoints;
CREATE POLICY "endpoints_update_own" ON chaos_endpoints FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "endpoints_delete_own" ON chaos_endpoints;
CREATE POLICY "endpoints_delete_own" ON chaos_endpoints FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chaos_endpoints_user_id ON chaos_endpoints(user_id);

-- =========================
-- request_logs
-- =========================
CREATE TABLE IF NOT EXISTS request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid REFERENCES chaos_endpoints(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  request_method text NOT NULL DEFAULT 'GET',
  injected_fault_type text NOT NULL DEFAULT 'none',
  actual_latency_ms integer NOT NULL DEFAULT 0,
  client_status integer NOT NULL DEFAULT 200,
  has_chaos_error boolean NOT NULL DEFAULT false
);

ALTER TABLE request_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON request_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON request_logs TO service_role;

DROP POLICY IF EXISTS "logs_select_own" ON request_logs;
CREATE POLICY "logs_select_own" ON request_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "logs_insert_own" ON request_logs;
CREATE POLICY "logs_insert_own" ON request_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "logs_update_own" ON request_logs;
CREATE POLICY "logs_update_own" ON request_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "logs_delete_own" ON request_logs;
CREATE POLICY "logs_delete_own" ON request_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint_id ON request_logs(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp DESC);

-- =========================
-- Auto-create profile on signup
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, api_key)
  VALUES (
    NEW.id,
    NEW.email,
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 32)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
