import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/DataProvider'
import { formatINR, monthKeyFromDate } from '../lib/utils'
import { useI18n } from '../i18n/I18nProvider'

export function DashboardPage() {
  const { loading, students, payments, settings } = useData()
  const { t } = useI18n()
  const monthKey = monthKeyFromDate(new Date())

  const seatsTotal = Number(settings.totalSeats || 45)
  const todayDay = new Date().getDate()
  const dueCutoffDay = Math.min(28, Math.max(1, todayDay))

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

  const actions = useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const soonMs = 48 * 60 * 60 * 1000

    const monthPayments = payments.filter((p) => p.month === monthKey)
    const paidByStudent = new Map<string, number>()
    for (const p of monthPayments) {
      if (!p.student_id) continue
      paidByStudent.set(p.student_id, (paidByStudent.get(p.student_id) || 0) + Number(p.amount_paid || 0))
    }

    const active = students.filter((s) => s.status === 'Active')
    const withSeat = active.filter((s) => Number(s.seat_number))
    const noSeat = active.filter((s) => !Number(s.seat_number)).slice().sort((a, b) => a.full_name.localeCompare(b.full_name))

    const withDue = withSeat
      .map((s) => {
        const fee = Number(s.monthly_fee || settings.defaultMonthlyFee)
        const paid = paidByStudent.get(s.id) || 0
        const due = Math.max(0, fee - paid)
        return { s, due }
      })
      .filter((x) => x.due > 0)

    const dueToday = withDue
      .filter((x) => {
        const d = Number(x.s.due_day || 0)
        return d >= 1 && d <= dueCutoffDay
      })
      .slice()
      .sort((a, b) => (Number(a.s.due_day || 0) - Number(b.s.due_day || 0)) || (b.due - a.due))

    const pendingTop = withDue.slice().sort((a, b) => b.due - a.due)

    const expiringLinks = students
      .filter((s) => !!s.admission_token && !!s.admission_token_expires_at && !s.admission_submitted_at)
      .map((s) => {
        const exp = Date.parse(String(s.admission_token_expires_at))
        return { s, exp }
      })
      .filter((x) => Number.isFinite(x.exp) && x.exp > now && x.exp - now <= soonMs)
      .slice()
      .sort((a, b) => a.exp - b.exp)

    const recentAdmissions = students
      .filter((s) => !!s.admission_submitted_at)
      .map((s) => ({ s, ts: Date.parse(String(s.admission_submitted_at)) }))
      .filter((x) => Number.isFinite(x.ts) && x.ts >= weekAgo)
      .slice()
      .sort((a, b) => b.ts - a.ts)

    return {
      dueToday,
      pendingTop,
      noSeat,
      expiringLinks,
      recentAdmissions,
    }
  }, [students, payments, settings.defaultMonthlyFee, monthKey, dueCutoffDay])

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

      <div className="mt-4">
        <div className="sr-title">{t('todaysActions')}</div>
        <div className="sr-subtitle">{t('todaysActionsSubtitle', { day: todayDay })}</div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <ActionCard title={t('dueToday')} subtitle={t('dueTodayHint')}>
            <ActionList
              emptyLabel={t('nothingDueToday')}
              items={actions.dueToday.slice(0, 5).map((x) => ({
                key: x.s.id,
                title: x.s.full_name,
                meta: `${t('seatLabel', { n: x.s.seat_number })} • ${t('dueDayLabel', { n: x.s.due_day ?? '-' })} • ${t('dueAmountLabel', { amount: x.due })}`,
                primary: { label: t('recordPayment'), to: `/payments?student=${x.s.id}` },
                secondary: { label: t('view'), to: `/students?profile=${x.s.id}` },
              }))}
            />
          </ActionCard>

          <ActionCard title={t('pendingFees')} subtitle={t('pendingFeesHint')}>
            <ActionList
              emptyLabel={t('noPendingFees')}
              items={actions.pendingTop.slice(0, 5).map((x) => ({
                key: x.s.id,
                title: x.s.full_name,
                meta: `${t('seatLabel', { n: x.s.seat_number })} • ${t('dueAmountLabel', { amount: x.due })}`,
                primary: { label: t('recordPayment'), to: `/payments?student=${x.s.id}` },
                secondary: { label: t('view'), to: `/students?profile=${x.s.id}` },
              }))}
            />
          </ActionCard>

          <ActionCard title={t('studentsWithoutSeat')} subtitle={t('studentsWithoutSeatHint')}>
            <ActionList
              emptyLabel={t('noStudentsWithoutSeat')}
              items={actions.noSeat.slice(0, 5).map((s) => ({
                key: s.id,
                title: s.full_name,
                meta: t('noSeat'),
                primary: { label: t('assignSeat'), to: `/students?profile=${s.id}` },
              }))}
            />
          </ActionCard>

          <ActionCard title={t('expiringLinks')} subtitle={t('expiringLinksHint')}>
            <ActionList
              emptyLabel={t('noExpiringLinks')}
              items={actions.expiringLinks.slice(0, 5).map((x) => ({
                key: x.s.id,
                title: x.s.full_name,
                meta: x.s.admission_token_expires_at ? String(x.s.admission_token_expires_at) : '',
                primary: x.s.admission_token
                  ? { label: t('openAdmissionForm'), to: `/admission/${x.s.admission_token}` }
                  : undefined,
                secondary: { label: t('view'), to: `/students?profile=${x.s.id}` },
              }))}
            />
          </ActionCard>

          <ActionCard title={t('recentAdmissions')} subtitle={t('recentAdmissionsHint')}>
            <ActionList
              emptyLabel={t('noRecentAdmissions')}
              items={actions.recentAdmissions.slice(0, 5).map((x) => ({
                key: x.s.id,
                title: x.s.full_name,
                meta: x.s.admission_submitted_at ? String(x.s.admission_submitted_at) : '',
                primary: { label: t('view'), to: `/students?profile=${x.s.id}` },
                secondary: { label: t('printAdmissionForm'), to: `/admission/print/${x.s.id}` },
              }))}
            />
          </ActionCard>
        </div>
      </div>

      {loading ? <div className="mt-4 text-sm text-slate-400">{t('loading')}</div> : null}
    </div>
  )
}

function ActionCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="sr-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
        </div>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function ActionList({
  items,
  emptyLabel,
}: {
  items: Array<{
    key: string
    title: string
    meta?: string
    primary?: { label: string; to: string }
    secondary?: { label: string; to: string }
  }>
  emptyLabel: string
}) {
  if (!items.length) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</div>
  }

  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.key} className="rounded-xl border border-slate-200 bg-white/60 p-2 dark:border-slate-800 dark:bg-slate-900/30">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{it.title}</div>
              {it.meta ? <div className="text-xs text-slate-600 dark:text-slate-400 truncate">{it.meta}</div> : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {it.secondary ? (
                <Link className="sr-btn-sm" to={it.secondary.to}>
                  {it.secondary.label}
                </Link>
              ) : null}
              {it.primary ? (
                <Link className="sr-btn-sm" to={it.primary.to}>
                  {it.primary.label}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ))}
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
