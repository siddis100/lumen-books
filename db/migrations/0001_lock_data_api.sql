-- =====================================================================
-- 0001 — Lock down the Data API
--
-- Why: a Supabase project is created with
--   "Automatically expose new tables" ON, which runs
--     GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated
--     ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon, authenticated
--
-- `anon` is not a secret: the publishable key travels inside the browser
-- bundle, so anybody reading the page gets it. With those grants, and with
-- no RLS policy on orders / order_items / downloads / promo_codes /
-- settings / rate_limits, the Data API would happily return every order,
-- every customer e-mail, every promo code and every issued download link
-- to anyone who typed one curl command.
--
-- Lumen Books reads and writes every table through Drizzle using the
-- service-role connection, and uses supabase-js only for Auth and Storage.
-- Nothing in src/ queries a table through the Data API, so these grants are
-- dead weight that can only do harm.
--
-- RLS stays enabled on the public tables: should a grant ever be restored by
-- accident, the policies still refuse reads and writes.
--
-- Safe to re-run: REVOKE and ALTER DEFAULT PRIVILEGES are idempotent.
-- =====================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- PUBLIC covers "every role, including future ones": drop it too.
revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from public;
revoke all on all functions in schema public from public;

alter default privileges in schema public revoke all on tables from public;
alter default privileges in schema public revoke all on sequences from public;
alter default privileges in schema public revoke all on functions from public;

-- PUBLIC also holds USAGE on the schema itself, which is enough for PostgREST
-- to see the tables at all.
revoke all on schema public from public;
grant usage on schema public to anon, authenticated;