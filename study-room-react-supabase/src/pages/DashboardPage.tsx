import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/DataProvider'
import { formatINR, formatLocalDateTime, monthKeyFromDate } from '../lib/utils'
import { useI18n } from '../i18n/I18nProvider'
import type { Payment } from '../lib/types'
import StudyRoomGallery from '../components/StudyRoomGallery'

export function DashboardPage() {
  const { loading, students, settings, listPaymentsByMonth } = useData()
  const { t, locale } = useI18n()
  const monthKey = monthKeyFromDate(new Date())

  const [monthPayments, setMonthPayments] = useState<Payment[]>([])

  useEffect(() => {
    let cancelled = false
    listPaymentsByMonth(monthKey)
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
  }, [monthKey, listPaymentsByMonth])

  const seatsTotal = Number(settings.totalSeats || 45)
  const todayDay = new Date().getDate()
  const dueCutoffDay = Math.min(28, Math.max(1, todayDay))

  const stats = useMemo(() => {
    const active = students.filter((s) => s.status === 'Active')
    const occupied = active.filter((s) => Number(s.seat_number)).length
    const available = seatsTotal - occupied
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
  }, [students, monthPayments, seatsTotal])

  const actions = useMemo(() => {
    const now = new Date().getTime()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const soonMs = 48 * 60 * 60 * 1000

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
  }, [students, monthPayments, settings, dueCutoffDay])

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="sr-title">{t('dashboardTitle')}</div>
          <div className="sr-subtitle">{t('dashboardMonth', { month: monthKey })}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link className="sr-btn" to="/students">
            {t('addStudent')}
          </Link>
          <Link className="sr-btn-primary" to="/payments">
            {t('recordPayment')}
          </Link>
          <Link className="sr-btn" to="/seats">
            {t('navSeats')}
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={t('statTotalSeats')}
          value={
            <span>
              {stats.occupied}
              <span className="text-slate-400 dark:text-slate-500">/{seatsTotal}</span>
            </span>
          }
          meta={`${t('available')}: ${stats.available}`}
        >
          <ProgressBar value={stats.occupied} max={seatsTotal} />
        </KpiCard>

        <KpiCard label={t('statActiveStudents')} value={String(stats.activeCount)} />
        <KpiCard label={t('statMonthlyCollection')} value={formatINR(stats.collected)} />
        <KpiCard label={t('statPendingPayments')} value={String(stats.pendingCount)} />
      </div>

      <div className="mt-6">
        <StudyRoomGallery />
      </div>

      <div className="mt-6">
        <div className="sr-title">{t('todaysActions')}</div>
        <div className="sr-subtitle">{t('todaysActionsSubtitle', { day: todayDay })}</div>

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ActionCard
            title={t('dueToday')}
            subtitle={t('dueTodayHint')}
            count={actions.dueToday.length}
            headerLink={{ label: t('navPayments'), to: '/payments' }}
          >
            <ActionList
              emptyLabel={t('nothingDueToday')}
              emptyAction={{ label: t('navPayments'), to: '/payments' }}
              items={actions.dueToday.slice(0, 5).map((x) => ({
                key: x.s.id,
                title: x.s.full_name,
                meta: `${t('seatLabel', { n: x.s.seat_number })} • ${t('dueDayLabel', { n: x.s.due_day ?? '-' })} • ${t('due')}: ${formatINR(x.due)}`,
                primary: { label: t('recordPayment'), to: `/payments?student=${x.s.id}` },
                secondary: { label: t('view'), to: `/students?profile=${x.s.id}` },
              }))}
            />
          </ActionCard>

          <ActionCard
            title={t('pendingFees')}
            subtitle={t('pendingFeesHint')}
            count={actions.pendingTop.length}
            headerLink={{ label: t('navReports'), to: '/reports' }}
          >
            <ActionList
              emptyLabel={t('noPendingFees')}
              emptyAction={{ label: t('navReports'), to: '/reports' }}
              items={actions.pendingTop.slice(0, 5).map((x) => ({
                key: x.s.id,
                title: x.s.full_name,
                meta: `${t('seatLabel', { n: x.s.seat_number })} • ${t('due')}: ${formatINR(x.due)}`,
                primary: { label: t('recordPayment'), to: `/payments?student=${x.s.id}` },
                secondary: { label: t('view'), to: `/students?profile=${x.s.id}` },
              }))}
            />
          </ActionCard>

          <ActionCard
            title={t('studentsWithoutSeat')}
            subtitle={t('studentsWithoutSeatHint')}
            count={actions.noSeat.length}
            headerLink={{ label: t('navStudents'), to: '/students' }}
          >
            <ActionList
              emptyLabel={t('noStudentsWithoutSeat')}
              emptyAction={{ label: t('navStudents'), to: '/students' }}
              items={actions.noSeat.slice(0, 5).map((s) => ({
                key: s.id,
                title: s.full_name,
                meta: t('noSeat'),
                primary: { label: t('assignSeat'), to: `/students?edit=${s.id}` },
              }))}
            />
          </ActionCard>

          <ActionCard title={t('expiringLinks')} subtitle={t('expiringLinksHint')} count={actions.expiringLinks.length}>
            <ActionList
              emptyLabel={t('noExpiringLinks')}
              emptyAction={{ label: t('navStudents'), to: '/students' }}
              items={actions.expiringLinks.slice(0, 5).map((x) => ({
                key: x.s.id,
                title: x.s.full_name,
                meta: x.s.admission_token_expires_at ? formatLocalDateTime(String(x.s.admission_token_expires_at), locale === 'mr' ? 'mr-IN' : 'en-IN') : '',
                primary: x.s.admission_token
                  ? { label: t('openAdmissionForm'), to: `/admission/${x.s.admission_token}` }
                  : undefined,
                secondary: { label: t('view'), to: `/students?profile=${x.s.id}` },
              }))}
            />
          </ActionCard>

          <ActionCard title={t('recentAdmissions')} subtitle={t('recentAdmissionsHint')} count={actions.recentAdmissions.length}>
            <ActionList
              emptyLabel={t('noRecentAdmissions')}
              emptyAction={{ label: t('navStudents'), to: '/students' }}
              items={actions.recentAdmissions.slice(0, 5).map((x) => ({
                key: x.s.id,
                title: x.s.full_name,
                meta: x.s.admission_submitted_at ? formatLocalDateTime(String(x.s.admission_submitted_at), locale === 'mr' ? 'mr-IN' : 'en-IN') : '',
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

function ActionCard({
  title,
  subtitle,
  count,
  headerLink,
  defaultOpen,
  children,
}: {
  title: string
  subtitle: string
  count?: number
  headerLink?: { label: string; to: string }
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen))

  return (
    <div className="sr-card p-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="text-left min-w-0"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <div className="flex items-center gap-2">
            <div className="font-semibold">{title}</div>
            {typeof count === 'number' ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-2 py-0.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/20 dark:text-slate-300">
                {count}
              </span>
            ) : null}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {headerLink ? (
            <Link className="sr-btn-sm" to={headerLink.to}>
              {headerLink.label}
            </Link>
          ) : null}
          <button
            className="sr-btn-sm"
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle"
          >
            <span
              className={
                'inline-block text-slate-500 dark:text-slate-400 transition-transform ' +
                (open ? 'rotate-90' : '')
              }
              aria-hidden="true"
            >
              ▸
            </span>
          </button>
        </div>
      </div>
      {open ? <div className="mt-2">{children}</div> : null}
    </div>
  )
}

function ActionList({
  items,
  emptyLabel,
  emptyAction,
}: {
  items: Array<{
    key: string
    title: string
    meta?: string
    primary?: { label: string; to: string }
    secondary?: { label: string; to: string }
  }>
  emptyLabel: string
  emptyAction?: { label: string; to: string }
}) {
  if (!items.length) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span>{emptyLabel}</span>
        {emptyAction ? (
          <Link className="sr-btn-sm" to={emptyAction.to}>
            {emptyAction.label}
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white/60 overflow-hidden divide-y divide-slate-200 dark:border-slate-800 dark:bg-slate-950/20 dark:divide-slate-800">
      {items.map((it) => (
        <div key={it.key} className="px-3 py-2 hover:bg-slate-50/70 dark:hover:bg-slate-900/40">
          <div className="flex items-start justify-between gap-3">
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

function KpiCard({
  label,
  value,
  meta,
  children,
}: {
  label: string
  value: ReactNode
  meta?: string
  children?: ReactNode
}) {
  return (
    <div className="sr-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {meta ? <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{meta}</div> : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  )
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const safeMax = Math.max(1, Number.isFinite(max) ? max : 1)
  const safeVal = Math.max(0, Math.min(safeMax, Number.isFinite(value) ? value : 0))
  const pct = (safeVal / safeMax) * 100

  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden dark:bg-slate-900/40">
      <div className="h-full bg-sky-500/40" style={{ width: `${pct}%` }} />
    </div>
  )
}
