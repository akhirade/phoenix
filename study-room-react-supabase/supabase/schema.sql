-- Study Room Manager (shared) schema
-- Run this in Supabase SQL Editor.

-- Enable UUID generation
create extension if not exists pgcrypto;

-- App settings (single row: id = 'default')
create table if not exists public.app_settings (
  id text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Students
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_code text unique,
  full_name text not null,
  mobile text,
  parent_contact text,
  id_proof text,
  address text,
  joining_date date,
  seat_number int,
  monthly_fee int not null default 0,
  due_day int not null default 5,
  status text not null default 'Active',
  notes text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- One active student per seat (business rule)
create unique index if not exists students_unique_active_seat
on public.students (seat_number)
where status = 'Active' and seat_number is not null;

-- Payments (keep history even if student changes/deletes)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
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
