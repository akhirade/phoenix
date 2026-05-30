-- 002_admission_form.sql
-- Admission form fields + public RPCs for one-time token flow.
-- Safe to run multiple times.

-- Add admission + profile fields
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

-- Public admission context RPC
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

-- Public admission submit RPC (with validation)
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

grant execute on function public.get_admission_context(text) to anon;
grant execute on function public.submit_admission_form(text, text, date, text, text, text, text, text, text, text, text, text, boolean) to anon;
