-- 003_rls.sql
-- Row Level Security policies.
-- Safe to run multiple times.

alter table public.students enable row level security;
alter table public.payments enable row level security;
alter table public.app_settings enable row level security;

-- Students: any authenticated user can read/write
DROP POLICY IF EXISTS "students_select_auth" ON public.students;
CREATE POLICY "students_select_auth" ON public.students
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "students_insert_auth" ON public.students;
CREATE POLICY "students_insert_auth" ON public.students
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "students_update_auth" ON public.students;
CREATE POLICY "students_update_auth" ON public.students
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "students_delete_auth" ON public.students;
CREATE POLICY "students_delete_auth" ON public.students
FOR DELETE TO authenticated USING (true);

-- Payments: any authenticated user can read/write
DROP POLICY IF EXISTS "payments_select_auth" ON public.payments;
CREATE POLICY "payments_select_auth" ON public.payments
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "payments_insert_auth" ON public.payments;
CREATE POLICY "payments_insert_auth" ON public.payments
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "payments_update_auth" ON public.payments;
CREATE POLICY "payments_update_auth" ON public.payments
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "payments_delete_auth" ON public.payments;
CREATE POLICY "payments_delete_auth" ON public.payments
FOR DELETE TO authenticated USING (true);

-- Settings: any authenticated user can read/write the single settings row
DROP POLICY IF EXISTS "settings_select_auth" ON public.app_settings;
CREATE POLICY "settings_select_auth" ON public.app_settings
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "settings_insert_auth" ON public.app_settings;
CREATE POLICY "settings_insert_auth" ON public.app_settings
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "settings_update_auth" ON public.app_settings;
CREATE POLICY "settings_update_auth" ON public.app_settings
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "settings_delete_auth" ON public.app_settings;
CREATE POLICY "settings_delete_auth" ON public.app_settings
FOR DELETE TO authenticated USING (true);
