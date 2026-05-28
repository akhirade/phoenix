-- Study Room Manager RLS policies
-- Assumes you will DISABLE public sign-ups and invite only your 2-3 users.

alter table public.students enable row level security;
alter table public.payments enable row level security;
alter table public.app_settings enable row level security;

-- Students: any authenticated user can read/write
drop policy if exists "students_select_auth" on public.students;
create policy "students_select_auth" on public.students
for select to authenticated using (true);

drop policy if exists "students_insert_auth" on public.students;
create policy "students_insert_auth" on public.students
for insert to authenticated with check (true);

drop policy if exists "students_update_auth" on public.students;
create policy "students_update_auth" on public.students
for update to authenticated using (true) with check (true);

drop policy if exists "students_delete_auth" on public.students;
create policy "students_delete_auth" on public.students
for delete to authenticated using (true);

-- Payments: any authenticated user can read/insert
drop policy if exists "payments_select_auth" on public.payments;
create policy "payments_select_auth" on public.payments
for select to authenticated using (true);

drop policy if exists "payments_insert_auth" on public.payments;
create policy "payments_insert_auth" on public.payments
for insert to authenticated with check (true);

drop policy if exists "payments_update_auth" on public.payments;
create policy "payments_update_auth" on public.payments
for update to authenticated using (true) with check (true);

drop policy if exists "payments_delete_auth" on public.payments;
create policy "payments_delete_auth" on public.payments
for delete to authenticated using (true);

-- Settings: any authenticated user can read/write the single settings row
drop policy if exists "settings_select_auth" on public.app_settings;
create policy "settings_select_auth" on public.app_settings
for select to authenticated using (true);

drop policy if exists "settings_insert_auth" on public.app_settings;
create policy "settings_insert_auth" on public.app_settings
for insert to authenticated with check (true);

drop policy if exists "settings_update_auth" on public.app_settings;
create policy "settings_update_auth" on public.app_settings
for update to authenticated using (true) with check (true);

drop policy if exists "settings_delete_auth" on public.app_settings;
create policy "settings_delete_auth" on public.app_settings
for delete to authenticated using (true);
