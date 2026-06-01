import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useData } from '../lib/DataProvider'
import { formatINR, formatLocalDate, monthKeyFromDate, todayISODate } from '../lib/utils'
import type { Payment, PaymentMode } from '../lib/types'
import { useToast } from '../components/ToastProvider'
import { useI18n } from '../i18n/I18nProvider'

export function PaymentsPage() {
  const { students, addPayment, listPaymentsByMonth } = useData()
  const toast = useToast()
  const { t, locale } = useI18n()
  const [searchParams] = useSearchParams()
  const [month, setMonth] = useState(monthKeyFromDate(new Date()))
  const [monthPayments, setMonthPayments] = useState<Payment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const seedStudent = searchParams.get('student')

  const active = useMemo(() => students.filter((s) => s.status === 'Active'), [students])

  useEffect(() => {
    let cancelled = false
    setMonthPayments(null)
    listPaymentsByMonth(month)
      .then((rows) => {
        if (cancelled) return
        setMonthPayments(rows)
      })
      .catch(() => {
        if (cancelled) return
        setMonthPayments([])
      })

    return () => {
      cancelled = true
    }
  }, [month, listPaymentsByMonth])

  const unpaid = useMemo(() => {
    if (!monthPayments) return []
    const paidBy = new Map<string, number>()
    for (const p of monthPayments) {
      if (!p.student_id) continue
      paidBy.set(p.student_id, (paidBy.get(p.student_id) || 0) + Number(p.amount_paid || 0))
    }

    return active
      .filter((s) => s.seat_number)
      .map((s) => {
        const paid = paidBy.get(s.id) || 0
        const due = Math.max(0, Number(s.monthly_fee || 0) - paid)
        return { s, paid, due }
      })
      .filter((x) => x.due > 0)
      .sort((a, b) => Number(a.s.seat_number ?? 999) - Number(b.s.seat_number ?? 999))
  }, [active, monthPayments])

  function modeLabel(m: PaymentMode | string) {
    if (m === 'Cash') return t('modeCash')
    if (m === 'UPI') return t('modeUpi')
    if (m === 'Bank') return t('modeBank')
    return String(m)
  }

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setError(null)
    setBusy(true)

    try {
      const fd = new FormData(e.currentTarget)
      const studentId = String(fd.get('student_id') || '')
      const st = active.find((s) => s.id === studentId)
      if (!st) throw new Error(t('errSelectStudent'))

      const amount = Number(fd.get('amount_paid') || 0)
      if (amount <= 0) throw new Error(t('errAmountGtZero'))

      const mode = String(fd.get('payment_mode') || 'Cash') as PaymentMode
      const paymentDate = String(fd.get('payment_date') || todayISODate())

      const paidSoFar = monthPayments
        ? monthPayments
            .filter((p) => p.student_id === st.id)
            .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
        : 0
      const afterPaid = paidSoFar + amount
      const dueAfter = Math.max(0, Number(st.monthly_fee || 0) - afterPaid)
      const status = dueAfter <= 0 ? 'Paid' : afterPaid > 0 ? 'Partial Paid' : 'Pending'

      const payload: Omit<Payment, 'id' | 'created_at'> = {
        student_id: st.id,
        student_name: st.full_name,
        seat_number: st.seat_number,
        month,
        amount_paid: amount,
        payment_date: paymentDate,
        payment_mode: mode,
        transaction_id: String(fd.get('transaction_id') || '').trim() || null,
        remarks: String(fd.get('remarks') || '').trim() || null,
        status,
      }

      const inserted = await addPayment(payload)
      setMonthPayments((prev) => (prev ? [inserted, ...prev] : [inserted]))

      toast.success(t('paymentRecorded'))

      form.reset()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('errCouldNotAddPayment')
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div>
        <div className="sr-title">{t('paymentsTitle')}</div>
        <div className="sr-subtitle">{t('paymentsSubtitle')}</div>
      </div>

      {active.length === 0 ? (
        <div className="mt-4 sr-card p-3">
          <div className="font-medium text-sm">{t('noStudents')}</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Add an active student first to record payments.
          </div>
          <div className="mt-3">
            <Link className="sr-btn-primary" to="/students">
              {t('addStudent')}
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
        <div className="sr-card p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[220px]">
              <label className="block text-xs text-slate-400 mb-1">{t('monthInput')}</label>
              <input
                className="sr-input"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3">
            <div className="font-medium text-sm">{t('unpaidPartial')}</div>
            <div className="mt-2 sr-table-wrap">
              <table className="sr-table">
                <thead className="sr-thead">
                  <tr>
                    <th className="sr-th">{t('tableStudent')}</th>
                    <th className="sr-th">{t('tableSeat')}</th>
                    <th className="sr-th">{t('paid')}</th>
                    <th className="sr-th">{t('due')}</th>
                  </tr>
                </thead>
                <tbody>
                  {monthPayments === null ? (
                    <tr>
                      <td className="px-3 py-4 text-slate-400" colSpan={4}>
                        {t('loading')}
                      </td>
                    </tr>
                  ) : null}
                  {unpaid.map((x) => (
                    <tr key={x.s.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="sr-td">{x.s.full_name}</td>
                      <td className="sr-td">{x.s.seat_number}</td>
                      <td className="sr-td">{formatINR(x.paid)}</td>
                      <td className="sr-td font-medium">{formatINR(x.due)}</td>
                    </tr>
                  ))}
                  {monthPayments !== null && unpaid.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-slate-400" colSpan={4}>
                        {t('noPendingDues', { month })}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4">
            <div className="font-medium text-sm">{t('paymentRecords')}</div>
            <div
              className="mt-2 sr-table-wrap max-h-[420px] overflow-y-auto overflow-x-hidden"
              data-testid="payment-records-wrap"
              style={{ scrollbarGutter: 'stable' }}
            >
              <table className="sr-table">
                <thead className="sr-thead">
                  <tr>
                    <th className="sr-th whitespace-nowrap w-[120px] bg-slate-100 dark:bg-slate-900">{t('date')}</th>
                    <th className="sr-th bg-slate-100 dark:bg-slate-900">{t('tableStudent')}</th>
                    <th className="sr-th w-[64px] bg-slate-100 dark:bg-slate-900">{t('tableSeat')}</th>
                    <th className="sr-th w-[96px] bg-slate-100 dark:bg-slate-900">{t('amount')}</th>
                    <th className="sr-th w-[78px] bg-slate-100 dark:bg-slate-900">{t('mode')}</th>
                    <th className="sr-th w-[140px] bg-slate-100 dark:bg-slate-900">{t('txn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {monthPayments === null ? (
                    <tr>
                      <td className="px-3 py-4 text-slate-400" colSpan={6}>
                        {t('loading')}
                      </td>
                    </tr>
                  ) : null}
                  {(monthPayments ?? [])
                    .slice()
                    .sort((a, b) => String(b.payment_date).localeCompare(String(a.payment_date)))
                    .map((p) => (
                      <tr key={p.id} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="sr-td whitespace-nowrap w-[120px]">
                          {formatLocalDate(String(p.payment_date), locale === 'mr' ? 'mr-IN' : 'en-IN')}
                        </td>
                        <td className="sr-td break-words">{p.student_name}</td>
                        <td className="sr-td w-[64px]">{p.seat_number ?? '-'}</td>
                        <td className="sr-td font-medium w-[96px]">{formatINR(Number(p.amount_paid || 0))}</td>
                        <td className="sr-td w-[78px]">{modeLabel(p.payment_mode)}</td>
                        <td className="sr-td w-[140px] break-words">{p.transaction_id ?? '-'}</td>
                      </tr>
                    ))}
                  {monthPayments !== null && monthPayments.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-slate-400" colSpan={6}>
                        {t('noPaymentsForMonth', { month })}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="sr-card p-3">
          <div className="font-medium">{t('addPayment')}</div>

          {error ? (
            <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-900 dark:text-rose-100">
              {error}
            </div>
          ) : null}

          <form key={`pay-${seedStudent ?? 'none'}-${month}`} className="mt-3 space-y-3" onSubmit={onAdd}>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                {t('tableStudent')} <span className="text-rose-400">*</span>
              </label>
              <select
                className="sr-select"
                name="student_id"
                defaultValue={seedStudent ?? ''}
                required
              >
                <option value="">{t('select')}</option>
                {active
                  .slice()
                  .sort((a, b) => (Number(a.seat_number ?? 999) - Number(b.seat_number ?? 999)) || a.full_name.localeCompare(b.full_name))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}{s.seat_number ? ` (${t('seatLabel', { n: s.seat_number })})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  {t('amountPaid')} <span className="text-rose-400">*</span>
                </label>
                <input
                  className="sr-input"
                  type="number"
                  min={0}
                  name="amount_paid"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  {t('paymentDate')} <span className="text-rose-400">*</span>
                </label>
                <input
                  className="sr-input"
                  type="date"
                  name="payment_date"
                  defaultValue={todayISODate()}
                  onFocus={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('mode')}</label>
                <select className="sr-select" name="payment_mode" defaultValue="Cash">
                  <option value="Cash">{t('modeCash')}</option>
                  <option value="UPI">{t('modeUpi')}</option>
                  <option value="Bank">{t('modeBank')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('transactionId')}</label>
                <input className="sr-input" name="transaction_id" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">{t('remarks')}</label>
              <textarea
                className="sr-textarea"
                name="remarks"
                rows={3}
              />
            </div>

            <button
              className="w-full sr-btn-primary disabled:opacity-60"
              type="submit"
              disabled={busy}
            >
              {busy ? t('saving') : t('savePayment')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
