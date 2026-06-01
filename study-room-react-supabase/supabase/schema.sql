-- Study Room Manager (shared) schema
-- Run this in Supabase SQL Editor.

-- Enable UUID generation
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

-- App settings (single row: id = 'default')
create table if not exists public.app_settings (
  tenant_id uuid not null default public.current_tenant_id(),
  id text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.app_settings drop constraint if exists app_settings_pkey;
alter table public.app_settings add constraint app_settings_pkey primary key (tenant_id, id);

-- Students
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),
  student_code text unique,
  full_name text not null,
  mobile text,
  email text,
  birth_date date,
  gender text,
  parent_contact text,
  emergency_contact text,
  id_proof text,
  address text,
  preparing_exam text,
  first_payment_receipt_no text,
  joining_date date,
  seat_number int,
  monthly_fee int not null default 0,
  due_day int not null default 5,
  status text not null default 'Active',
  notes text,

  admission_token text,
  admission_token_expires_at timestamptz,
  admission_signature_name text,
  admission_terms_accepted_at timestamptz,
  admission_submitted_at timestamptz,

  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Optional upgrades (safe to re-run)
alter table public.students add column if not exists email text;
alter table public.students add column if not exists birth_date date;
alter table public.students add column if not exists gender text;
alter table public.students add column if not exists emergency_contact text;
alter table public.students add column if not exists preparing_exam text;
alter table public.students add column if not exists first_payment_receipt_no text;
alter table public.students add column if not exists admission_token text;
alter table public.students add column if not exists admission_token_expires_at timestamptz;
alter table public.students add column if not exists admission_signature_name text;
alter table public.students add column if not exists admission_terms_accepted_at timestamptz;
alter table public.students add column if not exists admission_submitted_at timestamptz;

create unique index if not exists students_admission_token_unique
on public.students (admission_token)
where admission_token is not null;

-- Unique mobile number (normalized digits) for data quality
-- NOTE: Creating this index will fail if duplicates already exist.
create unique index if not exists students_mobile_unique
on public.students (
  tenant_id,
  (regexp_replace(coalesce(mobile, ''), '[^0-9]+', '', 'g'))
)
where regexp_replace(coalesce(mobile, ''), '[^0-9]+', '', 'g') <> '';

-- One active student per seat (business rule)
create unique index if not exists students_unique_active_seat
on public.students (tenant_id, seat_number)
where status = 'Active' and seat_number is not null;

-- Payments (keep history even if student changes/deletes)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id(),
  student_id uuid references public.students(id) on delete set null,
  student_name text not null,
  seat_number int,
  month text not null, -- YYYY-MM
  amount_paid int not null,
  payment_date date not null,
  payment_mode text not null,
  transaction_id text,
  remarks text,
  status text,
  created_at timestamptz not null default now()
);

create index if not exists payments_student_id_idx on public.payments(student_id);
create index if not exists payments_month_idx on public.payments(month);

create index if not exists payments_month_payment_date_idx
on public.payments (month, payment_date desc);

create index if not exists payments_student_payment_date_idx
on public.payments (student_id, payment_date desc);

-- updated_at trigger for students and app_settings
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_students_updated_at on public.students;
create trigger trg_students_updated_at
before update on public.students
for each row execute function public.set_updated_at();

drop trigger if exists trg_settings_updated_at on public.app_settings;
create trigger trg_settings_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

-- Public admission form helpers
-- These functions let a student fill the admission form via a link token,
-- without exposing full table access to anonymous users.

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
  where id = 'default';

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
  v_mobile text;
begin
  if not p_accept_terms then
    raise exception 'Please accept the terms and conditions';
  end if;

  select id into v_id
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
    where s.id <> v_id
      and regexp_replace(coalesce(s.mobile, ''), '\\D+', '', 'g') = v_mobile
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
    and admission_token = p_token
    and (admission_token_expires_at is null or admission_token_expires_at > now());

  return v_id;
end;
$$;

-- Allow public (anon) usage for student-filled admission links.
grant execute on function public.get_admission_context(text) to anon;
grant execute on function public.submit_admission_form(text, text, date, text, text, text, text, text, text, text, text, text, boolean) to anon;
