import React, { useMemo, useState } from 'react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useData } from '../lib/DataProvider'
import { dueDayFromISODate, seatNumbers, todayISODate } from '../lib/utils'
import type { Student } from '../lib/types'
import { StudentProfileModal } from '../components/StudentProfileModal'
import { useToast } from '../components/ToastProvider'
import { useI18n } from '../i18n/I18nProvider'

const SEATS_TOTAL = 45

export function StudentsPage() {
  const { students, settings, upsertStudent, setStudentStatus } = useData()
  const toast = useToast()
  const { t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [editing, setEditing] = useState<Student | null>(null)
  const [seedSeat, setSeedSeat] = useState<number | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return students
      .filter((s) => {
        if (filter === 'active' && s.status !== 'Active') return false
        if (filter === 'inactive' && s.status !== 'Inactive') return false
        if (!q) return true
        const hay = `${s.full_name} ${s.mobile ?? ''} ${s.parent_contact ?? ''} ${s.student_code ?? ''}`.toLowerCase()
        return hay.includes(q)
      })
      .slice()
      .sort((a, b) => (Number(a.seat_number ?? 999) - Number(b.seat_number ?? 999)) || a.full_name.localeCompare(b.full_name))
  }, [students, query, filter])

  const occupiedBySeat = useMemo(() => {
    const map = new Map<number, Student>()
    for (const s of students) {
      if (s.status !== 'Active') continue
      if (s.seat_number) map.set(s.seat_number, s)
    }
    return map
  }, [students])

  useEffect(() => {
    const seat = searchParams.get('seat')
    const edit = searchParams.get('edit')

    if (edit) {
      const st = students.find((s) => s.id === edit)
      if (st) {
        setEditing(st)
        setSeedSeat(null)
      }
      return
    }

    if (seat) {
      const n = Number(seat)
      if (Number.isFinite(n) && n >= 1 && n <= SEATS_TOTAL) {
        setEditing(null)
        setSeedSeat(n)
      }
    }
  }, [searchParams, students])

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setError(null)
    setBusy(true)

    try {
      const fd = new FormData(e.currentTarget)
      const joiningDateRaw = String(fd.get('joining_date') || '').trim() || null
      const derivedDue = dueDayFromISODate(joiningDateRaw) ?? settings.defaultDueDay
      const payload: Partial<Student> = {
        id: editing?.id,
        student_code: editing?.student_code ?? makeStudentCode(students),
        full_name: String(fd.get('full_name') || '').trim(),
        mobile: cleanPhone(fd.get('mobile'), t('errMobile10Digits')),
        parent_contact: cleanPhone(fd.get('parent_contact'), t('errParent10Digits')),
        id_proof: String(fd.get('id_proof') || '').trim() || null,
        address: String(fd.get('address') || '').trim() || null,
        joining_date: joiningDateRaw,
        seat_number: fd.get('seat_number') ? Number(fd.get('seat_number')) : null,
        monthly_fee: Number(fd.get('monthly_fee') || settings.defaultMonthlyFee),
        due_day: Number(fd.get('due_day') || derivedDue),
        status: String(fd.get('status') || 'Active') as any,
        notes: String(fd.get('notes') || '').trim() || null,
      }

      if (!payload.full_name) throw new Error(t('errFullNameRequired'))
      if (!payload.mobile) throw new Error(t('errMobileRequired'))
      if (payload.due_day! < 1 || payload.due_day! > 28) throw new Error(t('errDueDayRange28'))

      if (payload.status === 'Inactive') payload.seat_number = null

      if (payload.status === 'Active' && !payload.seat_number) {
        throw new Error(t('errSeatRequiredActive'))
      }

      if (payload.seat_number) {
        const occ = occupiedBySeat.get(payload.seat_number)
        if (occ && occ.id !== editing?.id) {
          throw new Error(t('errSeatAlreadyOccupied', { seat: payload.seat_number, name: occ.full_name }))
        }
      }

      await upsertStudent(payload)
      toast.success(editing ? t('studentUpdated') : t('studentAdded'))
      setEditing(null)
      setSeedSeat(null)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('seat')
        next.delete('edit')
        return next
      })
      form.reset()
    } catch (err: any) {
      setError(err?.message || t('saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  function startEdit(s: Student) {
    setEditing(s)
    setSeedSeat(null)
    setError(null)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('edit', s.id)
      next.delete('seat')
      return next
    })
  }

  function openProfile(s: Student) {
    setProfileId(s.id)
    setProfileOpen(true)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="sr-title">{t('studentsTitle')}</div>
          <div className="sr-subtitle">{t('studentsSubtitle')}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
        <div className="sr-card p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs text-slate-400 mb-1">{t('search')}</label>
              <input
                className="sr-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
              />
            </div>
            <div className="w-[180px]">
              <label className="block text-xs text-slate-400 mb-1">{t('filter')}</label>
              <select
                className="sr-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
              >
                <option value="all">{t('filterAll')}</option>
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </select>
            </div>
          </div>

          <div className="mt-3 sr-table-wrap">
            <table className="sr-table">
              <thead className="sr-thead">
                <tr>
                  <th className="sr-th">{t('tableStudent')}</th>
                  <th className="sr-th">{t('tableSeat')}</th>
                  <th className="sr-th">{t('tableStatus')}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="border-t border-slate-800">
                    <td className="sr-td">
                      <div className="font-medium">{s.full_name}</div>
                      <div className="text-xs text-slate-400">
                        {s.mobile ?? ''}
                        {s.parent_contact ? ` • ${t('parent')}: ${s.parent_contact}` : ''}
                        {s.student_code ? ` • ${s.student_code}` : ''}
                      </div>
                    </td>
                    <td className="sr-td">{s.seat_number ?? '-'}</td>
                    <td className="sr-td">
                      <span
                        className={
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs ' +
                          (s.status === 'Active'
                            ? 'border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100'
                            : 'border-rose-600/30 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100')
                        }
                      >
                        {s.status === 'Active' ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="sr-td text-right whitespace-nowrap">
                      <button
                        className="sr-btn-sm"
                        onClick={() => openProfile(s)}
                      >
                        {t('view')}
                      </button>
                      <button
                        className="ml-2 sr-btn-sm"
                        onClick={() => startEdit(s)}
                      >
                        {t('edit')}
                      </button>
                      <button
                        className="ml-2 sr-btn-sm"
                        onClick={() =>
                          setStudentStatus(s.id, s.status === 'Active' ? 'Inactive' : 'Active').catch((e) =>
                            setError(e?.message || t('saveFailed')),
                          )
                        }
                      >
                        {s.status === 'Active' ? t('markInactive') : t('markActive')}
                      </button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-400" colSpan={4}>
                      {t('noStudents')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-xs text-slate-500">{t('totalSeatsEnforced', { n: SEATS_TOTAL })}</div>
        </div>

        <div className={
          'sr-card p-3 ' +
          (editing ? 'border-sky-400/40 bg-sky-500/5 shadow-[0_0_0_1px_rgba(56,189,248,0.14)]' : '')
        }>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">{editing ? t('editStudent') : t('addStudent')}</div>
              <div className="text-xs text-slate-400 mt-1">{t('seatClearedWhenInactive')}</div>
            </div>
            {editing ? (
              <span className="inline-flex items-center rounded-full border border-sky-500/35 bg-sky-50 px-2 py-0.5 text-xs text-sky-800 dark:border-sky-400/40 dark:bg-sky-500/10 dark:text-sky-100">
                {t('editing')}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-900/40 px-2 py-0.5 text-xs text-slate-200">
                {t('new')}
              </span>
            )}
          </div>

          {editing ? (
            <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-500/5 p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">{t('student')}</div>
              <div className="mt-1 text-sm font-semibold text-slate-100">{editing.full_name}</div>
              <div className="mt-0.5 text-xs text-slate-400">
                {editing.student_code ?? editing.id}
                {editing.seat_number ? ` • ${t('seatLabel', { n: editing.seat_number })}` : ''}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-900 dark:text-rose-100">
              {error}
            </div>
          ) : null}

          <form
            key={editing ? `edit-${editing.id}` : `new-${seedSeat ?? 'none'}`}
            className="mt-3 space-y-3"
            onSubmit={onSave}
          >
            <TextField name="full_name" label={t('fullName')} defaultValue={editing?.full_name} required />
            <div className="grid grid-cols-2 gap-3">
              <TextField name="mobile" label={t('mobileNumber')} defaultValue={editing?.mobile ?? ''} placeholder={t('phonePlaceholder10')} required />
              <TextField name="parent_contact" label={t('parentContact')} defaultValue={editing?.parent_contact ?? ''} placeholder={t('phonePlaceholder10')} />
            </div>
            <TextField name="id_proof" label={t('idProof')} defaultValue={editing?.id_proof ?? ''} />
            <TextField name="address" label={t('address')} defaultValue={editing?.address ?? ''} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('joiningDate')}</label>
                <input
                  className="sr-input"
                  type="date"
                  name="joining_date"
                  defaultValue={editing?.joining_date ?? todayISODate()}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('status')}</label>
                <select
                  className="sr-select"
                  name="status"
                  defaultValue={editing?.status ?? 'Active'}
                >
                  <option value="Active">{t('active')}</option>
                  <option value="Inactive">{t('inactive')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  {t('seatNumber')} <span className="text-rose-400">*</span>
                </label>
                <select
                  className="sr-select"
                  name="seat_number"
                  defaultValue={editing?.seat_number ?? seedSeat ?? ''}
                >
                  <option value="">{t('noSeat')}</option>
                  {seatNumbers(SEATS_TOTAL).map((n) => (
                    <option
                      key={n}
                      value={n}
                      disabled={Boolean(occupiedBySeat.get(n)) && occupiedBySeat.get(n)?.id !== editing?.id}
                    >
                      {t('seatLabel', { n })}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-[11px] text-slate-500">{t('requiredWhenActive')}</div>
              </div>
              <TextField
                name="monthly_fee"
                label={t('monthlyFee')}
                type="number"
                defaultValue={String(editing?.monthly_fee ?? settings.defaultMonthlyFee)}
              />
            </div>

              <TextField
                name="due_day"
                label={t('dueDay')}
                type="number"
                defaultValue={String(
                  editing?.due_day ??
                    dueDayFromISODate(editing?.joining_date ?? todayISODate()) ??
                    settings.defaultDueDay,
                )}
              />

            <div>
              <label className="block text-xs text-slate-400 mb-1">{t('notes')}</label>
              <textarea
                className="sr-textarea"
                name="notes"
                defaultValue={editing?.notes ?? ''}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              {editing ? (
                <button
                  type="button"
                  className="sr-btn"
                  onClick={() => {
                    setEditing(null)
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev)
                      next.delete('edit')
                      return next
                    })
                  }}
                >
                  {t('cancel')}
                </button>
              ) : null}
              <button
                type="submit"
                disabled={busy}
                className="sr-btn-primary disabled:opacity-60"
              >
                {busy ? t('saving') : editing ? t('saveChanges') : t('addStudentButton')}
              </button>
            </div>
          </form>
        </div>
      </div>

      <StudentProfileModal
        open={profileOpen}
        studentId={profileId}
        onClose={() => {
          setProfileOpen(false)
          setProfileId(null)
        }}
      />
    </div>
  )
}

function TextField({
  name,
  label,
  defaultValue,
  type = 'text',
  placeholder,
  required,
}: {
  name: string
  label: string
  defaultValue?: string | null
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">
        {label} {required ? <span className="text-rose-400">*</span> : null}
      </label>
      <input
        className="sr-input"
        name={name}
        defaultValue={defaultValue ?? ''}
        type={type}
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}

function cleanPhone(v: FormDataEntryValue | null, invalidMessage: string): string | null {
  const s = String(v || '').replace(/\s+/g, '').trim()
  if (!s) return null
  if (!/^\d{10}$/.test(s)) throw new Error(invalidMessage)
  return s
}

function makeStudentCode(existing: Student[]): string {
  for (let i = 0; i < 10; i++) {
    const code = `SR-${Math.floor(100000 + Math.random() * 900000)}`
    if (!existing.some((s) => s.student_code === code)) return code
  }
  return `SR-${Date.now()}`
}
