-- 010_public_settings_read.sql
-- Allow public (unauthenticated) users to read the default app_settings
-- (needed for landing page to display center name, phone, address, gallery images)

drop policy if exists "settings_select_public" on public.app_settings;
create policy "settings_select_public" on public.app_settings
for select to public using (id = 'default');
