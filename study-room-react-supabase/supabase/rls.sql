-- Study Room Manager RLS policies
-- Assumes you will DISABLE public sign-ups and invite only your 2-3 users.

-- Multi-tenant note:
-- This app uses one user -> one tenant, enforced by RLS on tenant_id.

alter table public.students enable row level security;
alter table public.payments enable row level security;
alter table public.app_settings enable row level security;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;

-- Helper required:
-- public.current_tenant_id() returns the tenant_id for auth.uid() via public.profiles.

-- Tenants: user can only read their tenant row
drop policy if exists "tenants_select_auth" on public.tenants;
create policy "tenants_select_auth" on public.tenants
for select to authenticated
using (id = public.current_tenant_id());

-- Profiles: user can read their own profile
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated
using (user_id = auth.uid());

-- Students: tenant-scoped
drop policy if exists "students_select_auth" on public.students;
create policy "students_select_auth" on public.students
for select to authenticated using (tenant_id = public.current_tenant_id());

drop policy if exists "students_insert_auth" on public.students;
create policy "students_insert_auth" on public.students
for insert to authenticated with check (tenant_id = public.current_tenant_id());

drop policy if exists "students_update_auth" on public.students;
create policy "students_update_auth" on public.students
for update to authenticated using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

drop policy if exists "students_delete_auth" on public.students;
create policy "students_delete_auth" on public.students
for delete to authenticated using (tenant_id = public.current_tenant_id());

-- Payments: tenant-scoped
drop policy if exists "payments_select_auth" on public.payments;
create policy "payments_select_auth" on public.payments
for select to authenticated using (tenant_id = public.current_tenant_id());

drop policy if exists "payments_insert_auth" on public.payments;
create policy "payments_insert_auth" on public.payments
for insert to authenticated with check (tenant_id = public.current_tenant_id());

drop policy if exists "payments_update_auth" on public.payments;
create policy "payments_update_auth" on public.payments
for update to authenticated using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

drop policy if exists "payments_delete_auth" on public.payments;
create policy "payments_delete_auth" on public.payments
for delete to authenticated using (tenant_id = public.current_tenant_id());

-- Settings: tenant-scoped
drop policy if exists "settings_select_auth" on public.app_settings;
create policy "settings_select_auth" on public.app_settings
for select to authenticated using (tenant_id = public.current_tenant_id());

drop policy if exists "settings_insert_auth" on public.app_settings;
create policy "settings_insert_auth" on public.app_settings
for insert to authenticated with check (tenant_id = public.current_tenant_id());

drop policy if exists "settings_update_auth" on public.app_settings;
create policy "settings_update_auth" on public.app_settings
for update to authenticated using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());

drop policy if exists "settings_delete_auth" on public.app_settings;
create policy "settings_delete_auth" on public.app_settings
for delete to authenticated using (tenant_id = public.current_tenant_id());

-- Storage: study room gallery uploads from Settings page
insert into storage.buckets (id, name, public)
values ('study-room', 'study-room', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "study_room_storage_insert_auth" on storage.objects;
create policy "study_room_storage_insert_auth" on storage.objects
for insert to authenticated
with check (bucket_id = 'study-room');

drop policy if exists "study_room_storage_update_auth" on storage.objects;
create policy "study_room_storage_update_auth" on storage.objects
for update to authenticated
using (bucket_id = 'study-room')
with check (bucket_id = 'study-room');

drop policy if exists "study_room_storage_delete_auth" on storage.objects;
create policy "study_room_storage_delete_auth" on storage.objects
for delete to authenticated
using (bucket_id = 'study-room');

drop policy if exists "study_room_storage_select_public" on storage.objects;
create policy "study_room_storage_select_public" on storage.objects
for select to public
using (bucket_id = 'study-room');
