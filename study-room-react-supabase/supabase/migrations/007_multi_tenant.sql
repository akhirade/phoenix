-- 007_multi_tenant.sql
-- Multi-tenant support (one user belongs to exactly one tenant / study room).
-- Enforces tenant isolation via RLS and tenant_id columns.
-- Safe to re-run.

create extension if not exists pgcrypto;

-- Tenants (study rooms)
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists tenants_name_unique on public.tenants (name);

-- Profiles: map authenticated users to a tenant
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists profiles_tenant_id_idx on public.profiles (tenant_id);

-- Helper: current tenant id for the logged-in user.
-- SECURITY DEFINER so it can read profiles regardless of RLS on profiles.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.tenant_id
  from public.profiles p
  where p.user_id = auth.uid();
$$;

-- Add tenant_id columns
alter table public.students add column if not exists tenant_id uuid;
alter table public.payments add column if not exists tenant_id uuid;
alter table public.app_settings add column if not exists tenant_id uuid;

-- Bootstrap: create a default tenant (if needed) and backfill existing rows.
do $$
declare
  v_tenant uuid;
begin
  select id into v_tenant from public.tenants order by created_at asc limit 1;

  if v_tenant is null then
    insert into public.tenants(name)
    values ('Phoenix Study Room')
    on conflict (name) do update set name = excluded.name
    returning id into v_tenant;
  end if;

  update public.students set tenant_id = v_tenant where tenant_id is null;
  update public.payments set tenant_id = v_tenant where tenant_id is null;
  update public.app_settings set tenant_id = v_tenant where tenant_id is null;
end;
$$;

-- Make tenant_id required + auto-filled for new rows.
alter table public.students alter column tenant_id set default public.current_tenant_id();
alter table public.payments alter column tenant_id set default public.current_tenant_id();
alter table public.app_settings alter column tenant_id set default public.current_tenant_id();

alter table public.students alter column tenant_id set not null;
alter table public.payments alter column tenant_id set not null;
alter table public.app_settings alter column tenant_id set not null;

-- Settings become per-tenant: primary key is (tenant_id, id)
alter table public.app_settings drop constraint if exists app_settings_pkey;
alter table public.app_settings add constraint app_settings_pkey primary key (tenant_id, id);

-- Students uniqueness should be per-tenant
alter table public.students drop constraint if exists students_student_code_key;

drop index if exists public.students_unique_active_seat;
create unique index if not exists students_unique_active_seat
on public.students (tenant_id, seat_number)
where status = 'Active' and seat_number is not null;

drop index if exists public.students_mobile_unique;
create unique index if not exists students_mobile_unique
on public.students (
  tenant_id,
  (regexp_replace(coalesce(mobile, ''), '[^0-9]+', '', 'g'))
)
where regexp_replace(coalesce(mobile, ''), '[^0-9]+', '', 'g') <> '';

create unique index if not exists students_tenant_student_code_unique
on public.students (tenant_id, student_code)
where coalesce(nullif(trim(student_code), ''), '') <> '';

-- Optional performance: indexes that help after tenant scoping
create index if not exists students_tenant_seat_idx on public.students (tenant_id, seat_number);
create index if not exists payments_tenant_month_idx on public.payments (tenant_id, month);
create index if not exists payments_tenant_student_idx on public.payments (tenant_id, student_id);

create index if not exists payments_tenant_month_payment_date_idx
on public.payments (tenant_id, month, payment_date desc);

create index if not exists payments_tenant_student_payment_date_idx
on public.payments (tenant_id, student_id, payment_date desc);

-- RLS: enable where needed
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;

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
for select to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists "students_insert_auth" on public.students;
create policy "students_insert_auth" on public.students
for insert to authenticated
with check (tenant_id = public.current_tenant_id());

drop policy if exists "students_update_auth" on public.students;
create policy "students_update_auth" on public.students
for update to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists "students_delete_auth" on public.students;
create policy "students_delete_auth" on public.students
for delete to authenticated
using (tenant_id = public.current_tenant_id());

-- Payments: tenant-scoped
drop policy if exists "payments_select_auth" on public.payments;
create policy "payments_select_auth" on public.payments
for select to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists "payments_insert_auth" on public.payments;
create policy "payments_insert_auth" on public.payments
for insert to authenticated
with check (tenant_id = public.current_tenant_id());

drop policy if exists "payments_update_auth" on public.payments;
create policy "payments_update_auth" on public.payments
for update to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists "payments_delete_auth" on public.payments;
create policy "payments_delete_auth" on public.payments
for delete to authenticated
using (tenant_id = public.current_tenant_id());

-- Settings: tenant-scoped
drop policy if exists "settings_select_auth" on public.app_settings;
create policy "settings_select_auth" on public.app_settings
for select to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists "settings_insert_auth" on public.app_settings;
create policy "settings_insert_auth" on public.app_settings
for insert to authenticated
with check (tenant_id = public.current_tenant_id());

drop policy if exists "settings_update_auth" on public.app_settings;
create policy "settings_update_auth" on public.app_settings
for update to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists "settings_delete_auth" on public.app_settings;
create policy "settings_delete_auth" on public.app_settings
for delete to authenticated
using (tenant_id = public.current_tenant_id());

-- Admission RPCs must read settings from the correct tenant.
create or replace function public.get_admission_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  st record;
  settings jsonb;
begin
  select
    id,
    tenant_id,
    full_name,
    mobile,
    email,
    address,
    birth_date,
    gender,
    emergency_contact,
    preparing_exam,
    first_payment_receipt_no,
    id_proof,
    joining_date
  into st
  from public.students
  where admission_token = p_token
    and (admission_token_expires_at is null or admission_token_expires_at > now())
  limit 1;

  if st.id is null then
    raise exception 'Invalid or expired link';
  end if;

  select value into settings
  from public.app_settings
  where tenant_id = st.tenant_id
    and id = 'default';

  return jsonb_build_object(
    'student', jsonb_build_object(
      'id', st.id,
      'full_name', st.full_name,
      'mobile', st.mobile,
      'email', st.email,
      'address', st.address,
      'birth_date', st.birth_date,
      'gender', st.gender,
      'emergency_contact', st.emergency_contact,
      'preparing_exam', st.preparing_exam,
      'first_payment_receipt_no', st.first_payment_receipt_no,
      'id_proof', st.id_proof,
      'joining_date', st.joining_date
    ),
    'center', jsonb_build_object(
      'name', coalesce(settings->>'centerName', 'Phoenix Study Room'),
      'address', coalesce(settings->>'centerAddress', ''),
      'phone', coalesce(settings->>'centerPhone', '')
    ),
    'terms', coalesce(settings->>'admissionTerms', '')
  );
end;
$$;

create or replace function public.submit_admission_form(
  p_token text,
  p_full_name text,
  p_birth_date date,
  p_gender text,
  p_mobile text,
  p_email text,
  p_address text,
  p_emergency_contact text,
  p_preparing_exam text,
  p_first_payment_receipt_no text,
  p_id_proof text,
  p_signature_name text,
  p_accept_terms boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_tenant uuid;
  v_mobile text;
begin
  if not p_accept_terms then
    raise exception 'Please accept the terms and conditions';
  end if;

  select id, tenant_id into v_id, v_tenant
  from public.students
  where admission_token = p_token
    and (admission_token_expires_at is null or admission_token_expires_at > now())
  limit 1;

  if v_id is null then
    raise exception 'Invalid or expired link';
  end if;

  if coalesce(nullif(trim(p_full_name), ''), '') = '' then
    raise exception 'Full name is required';
  end if;

  v_mobile := regexp_replace(coalesce(p_mobile, ''), '[^0-9]+', '', 'g');
  if v_mobile !~ '^[0-9]{10}$' then
    raise exception 'Mobile number must be 10 digits';
  end if;

  if exists (
    select 1
    from public.students s
    where s.tenant_id = v_tenant
      and s.id <> v_id
      and regexp_replace(coalesce(s.mobile, ''), '[^0-9]+', '', 'g') = v_mobile
  ) then
    raise exception 'Mobile number already used';
  end if;

  if coalesce(nullif(trim(p_address), ''), '') = '' then
    raise exception 'Address is required';
  end if;

  if coalesce(nullif(trim(p_gender), ''), '') = '' then
    raise exception 'Select gender';
  end if;

  update public.students
  set
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
    birth_date = p_birth_date,
    gender = nullif(trim(p_gender), ''),
    mobile = nullif(trim(v_mobile), ''),
    email = nullif(trim(p_email), ''),
    address = nullif(trim(p_address), ''),
    emergency_contact = nullif(trim(p_emergency_contact), ''),
    preparing_exam = nullif(trim(p_preparing_exam), ''),
    first_payment_receipt_no = nullif(trim(p_first_payment_receipt_no), ''),
    id_proof = nullif(trim(p_id_proof), ''),
    admission_signature_name = nullif(trim(p_signature_name), ''),
    admission_terms_accepted_at = now(),
    admission_submitted_at = now(),
    admission_token = null,
    admission_token_expires_at = null
  where id = v_id
    and tenant_id = v_tenant
    and admission_token = p_token
    and (admission_token_expires_at is null or admission_token_expires_at > now());

  return v_id;
end;
$$;

-- Keep public access enabled
grant execute on function public.get_admission_context(text) to anon;
grant execute on function public.submit_admission_form(text, text, date, text, text, text, text, text, text, text, text, text, boolean) to anon;
