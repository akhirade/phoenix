import { useMemo } from 'react'
import { useData } from '../lib/DataProvider'
import { formatINR, monthKeyFromDate } from '../lib/utils'
import { useI18n } from '../i18n/I18nProvider'

export function DashboardPage() {
  const { loading, students, payments, settings } = useData()
  const { t } = useI18n()
  const monthKey = monthKeyFromDate(new Date())

  const seatsTotal = Number(settings.totalSeats || 45)

  const stats = useMemo(() => {
    const active = students.filter((s) => s.status === 'Active')
    const occupied = active.filter((s) => Number(s.seat_number)).length
    const available = seatsTotal - occupied
    const monthPayments = payments.filter((p) => p.month === monthKey)
    const collected = monthPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)

    // Pending = active students with seat but not fully paid for this month
    const dueMap = new Map<string, number>()
    for (const s of active) {
      if (!s.seat_number) continue
      const paid = monthPayments
        .filter((p) => p.student_id === s.id)
        .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
      const due = Math.max(0, Number(s.monthly_fee || 0) - paid)
      dueMap.set(s.id, due)
    }
    const pendingCount = Array.from(dueMap.values()).filter((d) => d > 0).length

    return { activeCount: active.length, occupied, available, collected, pendingCount }
  }, [students, payments, monthKey, seatsTotal])

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="sr-title">{t('dashboardTitle')}</div>
          <div className="sr-subtitle">{t('dashboardMonth', { month: monthKey })}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label={t('statTotalSeats')} value={String(seatsTotal)} />
        <Stat label={t('statOccupied')} value={String(stats.occupied)} />
        <Stat label={t('statAvailable')} value={String(stats.available)} />
        <Stat label={t('statActiveStudents')} value={String(stats.activeCount)} />
        <Stat label={t('statMonthlyCollection')} value={formatINR(stats.collected)} />
        <Stat label={t('statPendingPayments')} value={String(stats.pendingCount)} />
      </div>

      {loading ? <div className="mt-4 text-sm text-slate-400">{t('loading')}</div> : null}
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
