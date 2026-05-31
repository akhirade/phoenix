-- 006_payments_order_indexes.sql
-- Add indexes that keep month/student payment queries fast as the payments table grows.

create index if not exists payments_month_payment_date_idx
on public.payments (month, payment_date desc);

create index if not exists payments_student_payment_date_idx
on public.payments (student_id, payment_date desc);
