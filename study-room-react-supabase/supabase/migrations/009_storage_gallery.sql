-- 009_storage_gallery.sql
-- Storage bucket + RLS for study room gallery uploads from Settings page.

insert into storage.buckets (id, name, public)
values ('study-room', 'study-room', true)
on conflict (id) do update set public = excluded.public;

-- Authenticated users can upload into this bucket.
drop policy if exists "study_room_storage_insert_auth" on storage.objects;
create policy "study_room_storage_insert_auth" on storage.objects
for insert to authenticated
with check (bucket_id = 'study-room');

-- Authenticated users can update/delete objects in this bucket.
drop policy if exists "study_room_storage_update_auth" on storage.objects;
create policy "study_room_storage_update_auth" on storage.objects
for update to authenticated
using (bucket_id = 'study-room')
with check (bucket_id = 'study-room');

drop policy if exists "study_room_storage_delete_auth" on storage.objects;
create policy "study_room_storage_delete_auth" on storage.objects
for delete to authenticated
using (bucket_id = 'study-room');

-- Public read for this bucket (anyone can view, no authentication needed).
drop policy if exists "study_room_storage_select_public" on storage.objects;
create policy "study_room_storage_select_public" on storage.objects
for select
using (bucket_id = 'study-room');
