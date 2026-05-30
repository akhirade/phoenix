-- 004_unique_mobile.sql
-- Enforce unique student mobile numbers (normalized).
-- NOTE: This migration will FAIL if duplicates already exist.

-- Pre-check: block if duplicates exist (after normalizing to digits only)
do $$
begin
  if exists (
    select 1
    from (
      select regexp_replace(coalesce(mobile, ''), '\\D+', '', 'g') as m
      from public.students
    ) x
    where x.m <> ''
    group by x.m
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce unique mobile: duplicates exist. Fix duplicates in students.mobile and re-run.';
  end if;
end;
$$;

-- Unique index on normalized mobile (digits only)
create unique index if not exists students_mobile_unique
on public.students ((regexp_replace(coalesce(mobile, ''), '\\D+', '', 'g')))
where regexp_replace(coalesce(mobile, ''), '\\D+', '', 'g') <> '';
