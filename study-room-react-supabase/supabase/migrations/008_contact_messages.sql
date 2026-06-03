-- 008_contact_messages.sql
-- Public contact/enquiry messages (landing page).
-- Safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  phone text not null,
  email text null,
  message text not null,
  source text not null default 'landing'
);

create index if not exists contact_messages_created_at_idx
on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;

-- Public: allow inserts only (no reads).
drop policy if exists "contact_messages_insert_anon" on public.contact_messages;
create policy "contact_messages_insert_anon" on public.contact_messages
for insert to anon
with check (
  char_length(full_name) between 1 and 120
  and char_length(phone) between 5 and 32
  and char_length(message) between 1 and 2000
);

-- Admin/staff: allow reading messages.
drop policy if exists "contact_messages_select_auth" on public.contact_messages;
create policy "contact_messages_select_auth" on public.contact_messages
for select to authenticated
using (true);
