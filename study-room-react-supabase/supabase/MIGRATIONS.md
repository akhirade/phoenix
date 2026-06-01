# Supabase migrations (manual, safe)

This repo keeps SQL migrations under `supabase/migrations/`.

## Why

- Makes DB changes repeatable and reviewable.
- Avoids re-running one giant `schema.sql` with mixed concerns.

## How to apply

1. Open Supabase dashboard → SQL Editor.
2. Apply migrations in filename order:
   - `001_init.sql`
   - `002_admission_form.sql`
   - `003_rls.sql`
   - `004_unique_mobile.sql`
   - `005_fix_mobile_regex.sql`
   - `006_payments_order_indexes.sql`
   - `007_multi_tenant.sql`

They are written to be **safe to re-run** (uses `if not exists`, `create or replace`, `drop policy if exists`, etc.).

## Generate a single SQL to paste

Run:

- `npm run db:migrations:print`

This prints a compiled SQL (all migration files concatenated in order). You can copy/paste that output into Supabase SQL editor.

## Note

Fully automatic DB migrations from GitHub Actions usually require Supabase CLI or a privileged database credential. This repo keeps migrations safe + manual by default.

## Multi-tenant provisioning (after 007)

This project uses **one user → one tenant** (study room) with strict RLS isolation.

- Create a tenant:
  - `insert into public.tenants(name) values ('My Study Room') returning id;`
- Assign a user to a tenant (run as admin in SQL editor):
  - `insert into public.profiles(user_id, tenant_id) values ('<auth_user_uuid>', '<tenant_uuid>') on conflict (user_id) do update set tenant_id = excluded.tenant_id;`

If a user has no row in `public.profiles`, `public.current_tenant_id()` returns `null` and RLS will hide all tenant-scoped data.
