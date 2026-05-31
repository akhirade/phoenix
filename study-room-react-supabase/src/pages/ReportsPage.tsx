import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/DataProvider'
import { formatINR, formatLocalDate, monthKeyFromDate } from '../lib/utils'
import { useI18n } from '../i18n/I18nProvider'

export function ReportsPage() {
  const { students, payments, settings } = useData()
  const { t, locale } = useI18n()
  const [month, setMonth] = useState(monthKeyFromDate(new Date()))
  const [ledgerStudentId, setLedgerStudentId] = useState('')

  const seatsTotal = Number(settings.totalSeats || 45)

  const active = useMemo(() => students.filter((s) => s.status === 'Active'), [students])

  const monthPayments = useMemo(() => payments.filter((p) => p.month === month), [payments, month])

  const paidByStudent = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of monthPayments) {
      if (!p.student_id) continue
      map.set(p.student_id, (map.get(p.student_id) || 0) + Number(p.amount_paid || 0))
    }
    return map
  }, [monthPayments])

  const expectedFee = useMemo(
    () =>
      active
        .filter((s) => s.seat_number)
        .reduce((sum, s) => sum + Number(s.monthly_fee || 0), 0),
    [active],
  )

  const totalCollected = useMemo(
    () => monthPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0),
    [monthPayments],
  )

  const pendingDues = useMemo(() => {
    return active
      .filter((s) => s.seat_number)
      .map((s) => {
        const fee = Number(s.monthly_fee || 0)
        const paid = paidByStudent.get(s.id) || 0
        const due = Math.max(0, fee - paid)
        return { s, fee, paid, due }
      })
      .filter((x) => x.due > 0)
      .sort((a, b) => Number(a.s.seat_number ?? 999) - Number(b.s.seat_number ?? 999))
  }, [active, paidByStudent])

  const monthSummary = useMemo(() => {
    const duesAll = active
      .filter((s) => s.seat_number)
      .map((s) => {
        const fee = Number(s.monthly_fee || 0)
        const paid = paidByStudent.get(s.id) || 0
        const due = Math.max(0, fee - paid)
        return { fee, paid, due }
      })

    const pendingAmount = duesAll.reduce((sum, x) => sum + x.due, 0)
    const paidCount = duesAll.filter((x) => x.due <= 0).length
    const partialCount = duesAll.filter((x) => x.paid > 0 && x.due > 0).length
    const pendingCount = duesAll.filter((x) => x.paid <= 0 && x.due > 0).length

    const occupied = active.filter((s) => Number(s.seat_number)).length
    const vacant = seatsTotal - occupied

    return { pendingAmount, paidCount, partialCount, pendingCount, occupied, vacant }
  }, [active, paidByStudent, seatsTotal])

  const modeTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of monthPayments) {
      const key = String(p.payment_mode || 'Unknown')
      map.set(key, (map.get(key) || 0) + Number(p.amount_paid || 0))
    }
    return {
      Cash: map.get('Cash') || 0,
      UPI: map.get('UPI') || 0,
      Bank: map.get('Bank') || 0,
      Other: Array.from(map.entries())
        .filter(([k]) => k !== 'Cash' && k !== 'UPI' && k !== 'Bank')
        .reduce((sum, [, v]) => sum + v, 0),
    }
  }, [monthPayments])

  const ledgerStudents = useMemo(
    () =>
      active
        .slice()
        .sort(
          (a, b) =>
            (Number(a.seat_number ?? 999) - Number(b.seat_number ?? 999)) ||
            a.full_name.localeCompare(b.full_name),
        ),
    [active],
  )

  const ledgerPayments = useMemo(() => {
    if (!ledgerStudentId) return []
    return payments
      .filter((p) => p.student_id === ledgerStudentId)
      .slice()
      .sort((a, b) => String(b.payment_date).localeCompare(String(a.payment_date)))
  }, [payments, ledgerStudentId])

  const ledgerTotal = useMemo(
    () => ledgerPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0),
    [ledgerPayments],
  )

  function downloadCsv(filename: string, csv: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function toCsv(rows: Record<string, string | number | null | undefined>[], headers: string[]) {
    function esc(v: string) {
      const s = String(v ?? '')
      if (/["]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      if (/[\n\r,]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const lines = [headers.map(esc).join(',')]
    for (const r of rows) {
      lines.push(headers.map((h) => esc(String(r[h] ?? ''))).join(','))
    }
    return lines.join('\n')
  }

  function exportPaymentsCsv() {
    const headers = ['Date', 'Month', 'Student', 'Seat', 'Amount', 'Mode', 'Transaction ID', 'Remarks', 'Status']
    const rows = monthPayments
      .slice()
      .sort((a, b) => String(b.payment_date).localeCompare(String(a.payment_date)))
      .map((p) => ({
        Date: p.payment_date,
        Month: p.month,
        Student: p.student_name,
        Seat: p.seat_number ?? '',
        Amount: Number(p.amount_paid || 0),
        Mode: p.payment_mode,
        'Transaction ID': p.transaction_id ?? '',
        Remarks: p.remarks ?? '',
        Status: p.status ?? '',
      }))

    downloadCsv(`payments-${month}.csv`, toCsv(rows, headers))
  }

  function exportDuesCsv() {
    const headers = ['Month', 'Seat', 'Student', 'Mobile', 'Parent', 'Fee', 'Paid', 'Due']
    const rows = pendingDues.map((x) => ({
      Month: month,
      Seat: x.s.seat_number ?? '',
      Student: x.s.full_name,
      Mobile: x.s.mobile ?? '',
      Parent: x.s.parent_contact ?? '',
      Fee: x.fee,
      Paid: x.paid,
      Due: x.due,
    }))
    downloadCsv(`pending-dues-${month}.csv`, toCsv(rows, headers))
  }

  function exportStudentsCsv() {
    const headers = ['Student Code', 'Student', 'Mobile', 'Parent', 'Seat', 'Fee', 'Due Day', 'Status', 'Address']
    const rows = students
      .slice()
      .sort(
        (a, b) =>
          (Number(a.seat_number ?? 999) - Number(b.seat_number ?? 999)) ||
          a.full_name.localeCompare(b.full_name),
      )
      .map((s) => ({
        'Student Code': s.student_code ?? '',
        Student: s.full_name,
        Mobile: s.mobile ?? '',
        Parent: s.parent_contact ?? '',
        Seat: s.seat_number ?? '',
        Fee: Number(s.monthly_fee || 0),
        'Due Day': Number(s.due_day || 0),
        Status: s.status,
        Address: s.address ?? '',
      }))
    downloadCsv(`students.csv`, toCsv(rows, headers))
  }

  return (
    <div>
      <div>
        <div className="sr-title">{t('reportsTitle')}</div>
        <div className="sr-subtitle">{t('reportsSubtitle')}</div>
      </div>

      {active.length === 0 ? (
        <div className="mt-4 sr-card-soft p-3">
          <div className="font-medium text-sm">{t('noStudents')}</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Add active students (with seats) to see monthly reports.
          </div>
          <div className="mt-3">
            <Link className="sr-btn-primary" to="/students">
              {t('addStudent')}
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mt-4 sr-card p-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('monthInput')}</label>
            <input
              className="w-[220px] sr-input"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="sr-btn" type="button" onClick={exportPaymentsCsv}>
              {t('exportPaymentsCsv')}
            </button>
            <button className="sr-btn" type="button" onClick={exportDuesCsv}>
              {t('exportDuesCsv')}
            </button>
            <button className="sr-btn" type="button" onClick={exportStudentsCsv}>
              {t('exportStudentsCsv')}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label={t('statExpected')} value={formatINR(expectedFee)} />
        <Stat label={t('statCollected')} value={formatINR(totalCollected)} />
        <Stat label={t('statPending')} value={formatINR(monthSummary.pendingAmount)} />
        <Stat label={t('statPaidStudents')} value={String(monthSummary.paidCount)} />
        <Stat label={t('statPartial')} value={String(monthSummary.partialCount)} />
        <Stat label={t('statPendingStudents')} value={String(monthSummary.pendingCount)} />
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label={t('statOccupied')} value={String(monthSummary.occupied)} />
        <Stat label={t('statVacant')} value={String(monthSummary.vacant)} />
        <Stat label={t('statSeats')} value={String(seatsTotal)} />
        <Stat label={t('statCash')} value={formatINR(modeTotals.Cash)} />
        <Stat label={t('statUpi')} value={formatINR(modeTotals.UPI)} />
        <Stat label={t('statBank')} value={formatINR(modeTotals.Bank + modeTotals.Other)} />
      </div>

      <div className="mt-4 sr-card p-3">
        <div className="font-medium text-sm">{t('pendingDuesTitle')}</div>

        <div className="mt-2 sr-table-wrap">
          <table className="sr-table">
            <thead className="sr-thead">
              <tr>
                <th className="sr-th">{t('tableSeat')}</th>
                <th className="sr-th">{t('tableStudent')}</th>
                <th className="sr-th">{t('mobile')}</th>
                <th className="sr-th">{t('parent')}</th>
                <th className="sr-th">{t('fee')}</th>
                <th className="sr-th">{t('paid')}</th>
                <th className="sr-th">{t('due')}</th>
              </tr>
            </thead>
            <tbody>
              {pendingDues.map((x) => (
                <tr key={x.s.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="sr-td whitespace-nowrap">{x.s.seat_number ?? '-'}</td>
                  <td className="sr-td">{x.s.full_name}</td>
                  <td className="sr-td whitespace-nowrap">{x.s.mobile ?? '-'}</td>
                  <td className="sr-td whitespace-nowrap">{x.s.parent_contact ?? '-'}</td>
                  <td className="sr-td whitespace-nowrap">{formatINR(x.fee)}</td>
                  <td className="sr-td whitespace-nowrap">{formatINR(x.paid)}</td>
                  <td className="sr-td whitespace-nowrap font-medium">{formatINR(x.due)}</td>
                </tr>
              ))}
              {pendingDues.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-400" colSpan={7}>
                    {t('noPendingDues', { month })}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 sr-card p-3">
        <div className="font-medium text-sm">{t('studentLedgerTitle')}</div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('tableStudent')}</label>
            <select className="sr-select" value={ledgerStudentId} onChange={(e) => setLedgerStudentId(e.target.value)}>
              <option value="">{t('select')}</option>
              {ledgerStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}{s.seat_number ? ` (${t('seatLabel', { n: s.seat_number })})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-slate-400">
            {ledgerStudentId ? (
              <span>
                {t('totalPaid')}: <span className="font-medium text-slate-200">{formatINR(ledgerTotal)}</span>
              </span>
            ) : (
              t('selectStudentForLedger')
            )}
          </div>
        </div>

        {ledgerStudentId ? (
          <div className="mt-3 sr-table-wrap">
            <table className="sr-table">
              <thead className="sr-thead">
                <tr>
                  <th className="sr-th whitespace-nowrap">{t('date')}</th>
                  <th className="sr-th whitespace-nowrap">{t('monthColumn')}</th>
                  <th className="sr-th">{t('amount')}</th>
                  <th className="sr-th">{t('mode')}</th>
                  <th className="sr-th">{t('transactionId')}</th>
                </tr>
              </thead>
              <tbody>
                {ledgerPayments.map((p) => (
                  <tr key={p.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="sr-td whitespace-nowrap">
                      {formatLocalDate(String(p.payment_date), locale === 'mr' ? 'mr-IN' : 'en-IN')}
                    </td>
                    <td className="sr-td whitespace-nowrap">{p.month}</td>
                    <td className="sr-td whitespace-nowrap font-medium">{formatINR(Number(p.amount_paid || 0))}</td>
                    <td className="sr-td whitespace-nowrap">{p.payment_mode}</td>
                    <td className="sr-td whitespace-nowrap">{p.transaction_id ?? '-'}</td>
                  </tr>
                ))}
                {ledgerPayments.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-400" colSpan={5}>
                      {t('noPaymentsYet')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}

      </div>

      <div className="mt-4 text-xs text-slate-500">{t('reportsNote')}</div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="sr-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}
