import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/DataProvider'
import { monthKeyFromDate, seatNumbers } from '../lib/utils'
import { StudentProfileModal } from '../components/StudentProfileModal'
import { AddStudentSeatModal } from '../components/AddStudentSeatModal'
import { useI18n } from '../i18n/I18nProvider'

type SeatState =
  | { kind: 'available' }
  | { kind: 'occupied'; studentId: string; name: string }
  | { kind: 'pending'; studentId: string; name: string; due: number }

export function SeatsPage() {
  const { students, payments, settings } = useData()
  const { t } = useI18n()
  const monthKey = monthKeyFromDate(new Date())
  const seatsTotal = Number(settings.totalSeats || 45)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [addSeat, setAddSeat] = useState<number | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const seatMap = useMemo(() => {
    const active = students.filter((s) => s.status === 'Active' && s.seat_number)
    const paidByStudent = new Map<string, number>()
    for (const p of payments) {
      if (p.month !== monthKey) continue
      if (!p.student_id) continue
      paidByStudent.set(p.student_id, (paidByStudent.get(p.student_id) || 0) + Number(p.amount_paid || 0))
    }

    const map = new Map<number, SeatState>()
    for (const s of active) {
      const paid = paidByStudent.get(s.id) || 0
      const due = Math.max(0, Number(s.monthly_fee || 0) - paid)
      if (due > 0) {
        map.set(s.seat_number!, { kind: 'pending', studentId: s.id, name: s.full_name, due })
      } else {
        map.set(s.seat_number!, { kind: 'occupied', studentId: s.id, name: s.full_name })
      }
    }
    return map
  }, [students, payments, monthKey])

  function onSeatClick(seat: number, state: SeatState) {
    if (state.kind === 'available') {
      setAddSeat(seat)
      setAddOpen(true)
      return
    }
    setProfileId(state.studentId)
    setProfileOpen(true)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="sr-title">{t('seatsTitle')}</div>
          <div className="sr-subtitle">
            {t('seatsLegend', { month: monthKey })}
          </div>
        </div>
        <Link
          to="/students"
          className="sr-btn-primary"
        >
          {t('addManageStudents')}
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {seatNumbers(seatsTotal).map((n) => {
          const st = seatMap.get(n) || ({ kind: 'available' } as SeatState)
          return <SeatCard key={n} seat={n} state={st} onClick={() => onSeatClick(n, st)} />
        })}
      </div>

      <StudentProfileModal
        open={profileOpen}
        studentId={profileId}
        onClose={() => {
          setProfileOpen(false)
          setProfileId(null)
        }}
      />

      <AddStudentSeatModal
        open={addOpen}
        seatNumber={addSeat}
        onClose={() => {
          setAddOpen(false)
          setAddSeat(null)
        }}
      />
    </div>
  )
}

function SeatCard({
  seat,
  state,
  onClick,
}: {
  seat: number
  state: SeatState
  onClick: () => void
}) {
  const { t } = useI18n()
  const base = 'sr-card p-3'
  const cls =
    state.kind === 'available'
      ? `${base} border-emerald-600/30 bg-emerald-50/80 dark:border-emerald-500/25 dark:bg-emerald-500/5`
      : state.kind === 'pending'
        ? `${base} border-amber-600/30 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/5`
        : `${base} border-rose-600/30 bg-rose-50/80 dark:border-rose-500/30 dark:bg-rose-500/5`

  const hoverCls =
    state.kind === 'available'
      ? 'hover:border-emerald-600/45 hover:bg-emerald-100/70 dark:hover:border-emerald-400/45 dark:hover:bg-emerald-500/10'
      : state.kind === 'pending'
        ? 'hover:border-amber-600/45 hover:bg-amber-100/70 dark:hover:border-amber-400/45 dark:hover:bg-amber-500/10'
        : 'hover:border-rose-600/45 hover:bg-rose-100/70 dark:hover:border-rose-400/45 dark:hover:bg-rose-500/10'

  const badge =
    state.kind === 'available'
      ? 'border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100'
      : state.kind === 'pending'
        ? 'border-amber-600/30 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
        : 'border-rose-600/30 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100'

  return (
    <button
      type="button"
      className={
        cls + ' ' + hoverCls + ' text-left transition-colors'
      }
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">{t('seatLabel', { n: seat })}</div>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${badge}`}>
          {state.kind === 'available' ? t('available') : state.kind === 'pending' ? t('pending') : t('occupied')}
        </span>
      </div>

      <div className="mt-2 text-sm">
        {state.kind === 'available' ? (
          <span className="text-slate-500 dark:text-slate-400">{t('available')}</span>
        ) : (
          <span className="text-slate-900 dark:text-slate-100 font-medium">{state.name}</span>
        )}
      </div>

      {state.kind === 'pending' ? (
        <div className="mt-1 text-xs text-amber-700 dark:text-amber-200">
          {t('dueAmountLabel', { amount: state.due })}
        </div>
      ) : null}

      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {state.kind === 'available' ? t('clickToAssign') : t('clickToView')}
      </div>
    </button>
  )
}
