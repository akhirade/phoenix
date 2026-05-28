import { useMemo, useState } from 'react'
import { useData } from '../lib/DataProvider'
import { formatINR, monthKeyFromDate } from '../lib/utils'
import { useI18n } from '../i18n/I18nProvider'

const SEATS_TOTAL = 45

export function ReportsPage() {
  const { students, payments } = useData()
  const { t } = useI18n()
  const [month, setMonth] = useState(monthKeyFromDate(new Date()))

  const report = useMemo(() => {
    const active = students.filter((s) => s.status === 'Active')
    const occupied = active.filter((s) => Number(s.seat_number)).length
    const vacant = SEATS_TOTAL - occupied

    const monthPayments = payments.filter((p) => p.month === month)
    const totalCollected = monthPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)

    const paidBy = new Map<string, number>()
    for (const p of monthPayments) {
      if (!p.student_id) continue
      paidBy.set(p.student_id, (paidBy.get(p.student_id) || 0) + Number(p.amount_paid || 0))
    }

    const dues = active
      .filter((s) => s.seat_number)
      .map((s) => {
        const paid = paidBy.get(s.id) || 0
        const due = Math.max(0, Number(s.monthly_fee || 0) - paid)
        return { s, due }
      })

    const pendingAmount = dues.reduce((sum, x) => sum + x.due, 0)
    const paidCount = dues.filter((x) => x.due <= 0).length

    return { totalCollected, pendingAmount, paidCount, occupied, vacant }
  }, [students, payments, month])

  return (
    <div>
      <div>
        <div className="sr-title">{t('reportsTitle')}</div>
        <div className="sr-subtitle">{t('reportsSubtitle')}</div>
      </div>

      <div className="mt-4 sr-card p-3">
        <label className="block text-xs text-slate-400 mb-1">{t('monthInput')}</label>
        <input
          className="w-[220px] sr-input"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label={t('statCollected')} value={formatINR(report.totalCollected)} />
        <Stat label={t('statPending')} value={formatINR(report.pendingAmount)} />
        <Stat label={t('statPaidStudents')} value={String(report.paidCount)} />
        <Stat label={t('statOccupied')} value={String(report.occupied)} />
        <Stat label={t('statVacant')} value={String(report.vacant)} />
        <Stat label={t('statSeats')} value={String(SEATS_TOTAL)} />
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
