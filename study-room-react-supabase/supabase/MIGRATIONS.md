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

They are written to be **safe to re-run** (uses `if not exists`, `create or replace`, `drop policy if exists`, etc.).

## Generate a single SQL to paste

Run:

- `npm run db:migrations:print`

This prints a compiled SQL (all migration files concatenated in order). You can copy/paste that output into Supabase SQL editor.

## Note

Fully automatic DB migrations from GitHub Actions usually require Supabase CLI or a privileged database credential. This repo keeps migrations safe + manual by default.
