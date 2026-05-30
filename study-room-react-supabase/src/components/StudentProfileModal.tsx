import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/DataProvider'
import { dueDayFromISODate, formatINR, formatLocalDate, formatLocalDateTime, monthKeyFromDate, seatNumbers, todayISODate } from '../lib/utils'
import type { Student } from '../lib/types'
import { Modal } from './Modal'
import { Tag } from './Tag'
import { useToast } from './ToastProvider'
import { useI18n } from '../i18n/I18nProvider'

export function StudentProfileModal({
  open,
  studentId,
  onClose,
}: {
  open: boolean
  studentId: string | null
  onClose: () => void
}) {
  const { students, payments, settings, upsertStudent, ensureAdmissionLink, refreshStudent } = useData()
  const toast = useToast()
  const { t, locale } = useI18n()

  const intlLocale = locale === 'mr' ? 'mr-IN' : 'en-IN'

  const [mode, setMode] = useState<'profile' | 'edit'>('profile')
  const [focusField, setFocusField] = useState<'seat' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)

  const student = useMemo(
    () => (studentId ? students.find((s) => s.id === studentId) ?? null : null),
    [students, studentId],
  )

  const occupiedBySeat = useMemo(() => {
    const map = new Map<number, Student>()
    for (const s of students) {
      if (s.status !== 'Active') continue
      if (!s.seat_number) continue
      map.set(s.seat_number, s)
    }
    return map
  }, [students])

  const monthKey = monthKeyFromDate(new Date())

  const history = useMemo(() => {
    if (!studentId) return []
    return payments
      .filter((p) => p.student_id === studentId)
      .slice()
      .sort((a, b) => String(b.payment_date).localeCompare(String(a.payment_date)))
  }, [payments, studentId])

  const current = useMemo(() => {
    if (!studentId) return null
    const paid = payments
      .filter((p) => p.student_id === studentId && p.month === monthKey)
      .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)

    const fee = Number(student?.monthly_fee ?? settings.defaultMonthlyFee)
    const due = Math.max(0, fee - paid)

    return {
      fee,
      paid,
      due,
      status:
        due > 0
          ? { kind: 'warn' as const, label: `${t('pending')} (${formatINR(due)})` }
          : { kind: 'good' as const, label: t('paidStatus') },
    }
  }, [payments, studentId, monthKey, student?.monthly_fee, settings.defaultMonthlyFee, t])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      setMode('profile')
      setFocusField(null)
      setBusy(false)
      setError(null)
    }, 0)
    return () => window.clearTimeout(id)
  }, [open, studentId])

  useEffect(() => {
    if (!open) return
    if (!studentId) return
    refreshStudent(studentId).catch(() => {
      // ignore: non-blocking refresh
    })
  }, [open, studentId, refreshStudent])

  useEffect(() => {
    if (mode !== 'edit') return
    if (focusField !== 'seat') return

    const el = bodyRef.current?.querySelector('select[name="seat_number"]') as HTMLSelectElement | null
    if (!el) return
    // Let the form render first.
    window.setTimeout(() => {
      el.scrollIntoView({ block: 'center' })
      el.focus()
    }, 0)
  }, [mode, focusField])

  function getValidAdmissionToken(st: Student): string | null {
    if (!st.admission_token) return null
    if (!st.admission_token_expires_at) return st.admission_token

    const exp = Date.parse(st.admission_token_expires_at)
    if (!Number.isFinite(exp)) return st.admission_token
    if (exp > Date.now()) return st.admission_token
    return null
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setMode('profile')
        setFocusField(null)
        setError(null)
        onClose()
      }}
      title={mode === 'edit' ? t('editStudent') : t('studentProfile')}
      subtitle={student ? student.full_name : undefined}
    >
      {student ? (
        <div ref={bodyRef} className="space-y-3">
          {mode === 'edit' ? (
            <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-3 text-sm text-slate-100">
              {t('editing')} <span className="font-semibold">{student.full_name}</span>
              {student.seat_number ? ` • ${t('seatLabel', { n: student.seat_number })}` : ''}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-900 dark:text-rose-100">
              {error}
            </div>
          ) : null}

          {mode === 'edit' ? (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault()
                const form = e.currentTarget
                setError(null)
                setBusy(true)
                try {
                  const fd = new FormData(form)
                  const fullName = String(fd.get('full_name') || '').trim()
                  const mobile = cleanPhoneRequired(fd.get('mobile'), t('errMobileRequired'), t('errMobile10Digits'))
                  const parent = cleanPhoneOptional(fd.get('parent_contact'), t('errParent10Digits'))
                  const idProof = String(fd.get('id_proof') || '').trim() || null
                  const address = String(fd.get('address') || '').trim() || null
                  const joiningDate = String(fd.get('joining_date') || '').trim() || null
                  const monthlyFee = Number(fd.get('monthly_fee') || 0)
                  const derivedDue = dueDayFromISODate(joiningDate) ?? settings.defaultDueDay
                  const dueDay = Number(fd.get('due_day') || derivedDue)
                  const status = String(fd.get('status') || 'Active') as 'Active' | 'Inactive'
                  const notes = String(fd.get('notes') || '').trim() || null

                  let seatNumber: number | null = fd.get('seat_number')
                    ? Number(fd.get('seat_number'))
                    : null

                  if (!fullName) throw new Error(t('errFullNameRequired'))
                  if (dueDay < 1 || dueDay > 28) throw new Error(t('errDueDayRange28'))
                  if (status === 'Inactive') seatNumber = null
                  if (status === 'Active' && !seatNumber) throw new Error(t('errSeatRequiredActive'))

                  if (seatNumber) {
                    const occ = occupiedBySeat.get(seatNumber)
                    if (occ && occ.id !== student.id) throw new Error(t('errSeatAlreadyOccupied', { seat: seatNumber, name: occ.full_name }))
                  }

                  await upsertStudent({
                    id: student.id,
                    student_code: student.student_code,
                    full_name: fullName,
                    mobile,
                    parent_contact: parent,
                    id_proof: idProof,
                    address,
                    joining_date: joiningDate,
                    seat_number: seatNumber,
                    monthly_fee: monthlyFee,
                    due_day: dueDay,
                    status,
                    notes,
                  })

                  toast.success(t('studentUpdated'))
                  setMode('profile')
                } catch (err) {
                  const msg = err instanceof Error ? err.message : t('errFailedUpdateStudent')
                  setError(msg)
                  toast.error(msg)
                } finally {
                  setBusy(false)
                }
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {t('fullName')} <span className="text-rose-400">*</span>
                  </label>
                  <input className="sr-input" name="full_name" defaultValue={student.full_name} required />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {t('mobile')} <span className="text-rose-400">*</span>
                  </label>
                  <input className="sr-input" name="mobile" defaultValue={student.mobile ?? ''} required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('parentContact')}</label>
                  <input className="sr-input" name="parent_contact" defaultValue={student.parent_contact ?? ''} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('idProof')}</label>
                  <input className="sr-input" name="id_proof" defaultValue={student.id_proof ?? ''} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('address')}</label>
                <input className="sr-input" name="address" defaultValue={student.address ?? ''} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('joiningDate')}</label>
                  <input
                    className="sr-input"
                    type="date"
                    name="joining_date"
                    defaultValue={student.joining_date ?? todayISODate()}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('status')}</label>
                  <select className="sr-select" name="status" defaultValue={student.status ?? 'Active'}>
                    <option value="Active">{t('active')}</option>
                    <option value="Inactive">{t('inactive')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {t('seatNumber')} <span className="text-rose-400">*</span>
                  </label>
                  <select className="sr-select" name="seat_number" defaultValue={student.seat_number ?? ''}>
                    <option value="">{t('noSeat')}</option>
                    {seatNumbers(Number(settings.totalSeats || 45)).map((n) => (
                      <option
                        key={n}
                        value={n}
                        disabled={Boolean(occupiedBySeat.get(n)) && occupiedBySeat.get(n)?.id !== student.id}
                      >
                        {t('seatLabel', { n })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('monthlyFee')}</label>
                  <input
                    className="sr-input"
                    type="number"
                    min={0}
                    name="monthly_fee"
                    defaultValue={student.monthly_fee ?? settings.defaultMonthlyFee}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('dueDay')}</label>
                  <input
                    className="sr-input"
                    type="number"
                    min={1}
                    max={28}
                    name="due_day"
                    defaultValue={
                      student.due_day ??
                      dueDayFromISODate(student.joining_date ?? todayISODate()) ??
                      settings.defaultDueDay
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('notes')}</label>
                <textarea className="sr-textarea" name="notes" rows={3} defaultValue={student.notes ?? ''} />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button type="button" className="sr-btn" onClick={() => setMode('profile')}>
                  {t('cancel')}
                </button>
                <button type="submit" className="sr-btn-primary disabled:opacity-60" disabled={busy}>
                  {busy ? t('saving') : t('saveChanges')}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Info label={t('studentId')} value={student.student_code ?? student.id} />
                <Info label={t('mobile')} value={student.mobile ?? '-'} />
                <Info label={t('parent')} value={student.parent_contact ?? '-'} />
                <Info label={t('seat')} value={student.seat_number ? String(student.seat_number) : '-'} />
                <Info label={t('joiningDate')} value={student.joining_date ?? '-'} />
                <Info
                  label={t('status')}
                  value={
                    <Tag kind={student.status === 'Active' ? 'good' : 'bad'}>
                      {student.status === 'Active' ? t('active') : t('inactive')}
                    </Tag>
                  }
                />
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm">{t('admissionForm')}</div>
                  <Tag kind={student.admission_submitted_at ? 'good' : 'warn'}>
                    {student.admission_submitted_at ? t('admissionSubmitted') : t('admissionNotSubmitted')}
                  </Tag>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <button
                    className="sr-btn"
                    type="button"
                    onClick={async () => {
                      try {
                        const token = getValidAdmissionToken(student) ?? (await ensureAdmissionLink(student.id))
                        const base = new URL(import.meta.env.BASE_URL || '/', window.location.origin)
                        const url = new URL(`admission/${token}`, base).toString()
                        window.location.assign(url)
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : 'Failed'
                        toast.error(msg)
                      }
                    }}
                  >
                    {t('openAdmissionForm')}
                  </button>

                  <button
                    className="sr-btn"
                    type="button"
                    onClick={async () => {
                      try {
                        const token = getValidAdmissionToken(student) ?? (await ensureAdmissionLink(student.id))

                        const base = new URL(import.meta.env.BASE_URL || '/', window.location.origin)
                        const url = new URL(`admission/${token}`, base).toString()
                        await navigator.clipboard.writeText(url)
                        toast.success(t('admissionLinkCopied'))
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : 'Failed'
                        toast.error(msg)
                      }
                    }}
                  >
                    {t('copyAdmissionLink')}
                  </button>

                  <Link className="sr-btn" to={`/admission/print/${student.id}`} onClick={onClose}>
                    {t('printAdmissionForm')}
                  </Link>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <Info label={t('submittedAt')} value={formatLocalDateTime(student.admission_submitted_at, intlLocale)} />
                  <Info label={t('signatureName')} value={student.admission_signature_name ?? '-'} />
                  <Info label={t('email')} value={student.email ?? '-'} />
                  <Info label={t('birthDate')} value={formatLocalDate(student.birth_date, intlLocale)} />
                  <Info label={t('gender')} value={student.gender ?? '-'} />
                  <Info label={t('emergencyContact')} value={student.emergency_contact ?? '-'} />
                  <Info label={t('preparingExam')} value={student.preparing_exam ?? '-'} />
                  <Info label={t('firstPaymentReceiptNo')} value={student.first_payment_receipt_no ?? '-'} />
                </div>

                <div className="mt-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">{t('address')}</div>
                  <div className="mt-1 rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-200 whitespace-pre-line">
                    {student.address ?? '-'}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm">{t('currentMonth', { month: monthKey })}</div>
                  {current ? <Tag kind={current.status.kind}>{current.status.label}</Tag> : null}
                </div>
                {current ? (
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <Info label={t('fee')} value={formatINR(current.fee)} />
                    <Info label={t('paid')} value={formatINR(current.paid)} />
                    <Info
                      label={t('due')}
                      value={<span className="font-semibold">{formatINR(current.due)}</span>}
                    />
                  </div>
                ) : null}
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    className="sr-btn"
                    type="button"
                    onClick={() => {
                      setFocusField(null)
                      setMode('edit')
                    }}
                  >
                    {t('edit')}
                  </button>
                  <button
                    className="sr-btn"
                    type="button"
                    onClick={() => {
                      setFocusField('seat')
                      setMode('edit')
                    }}
                  >
                    {t('changeSeat')}
                  </button>
                  <Link className="sr-btn-primary" to={`/payments?student=${student.id}`} onClick={onClose}>
                    {t('recordPayment')}
                  </Link>
                </div>
              </div>

              <div>
                <div className="font-medium text-sm">{t('paymentHistory')}</div>
                {history.length === 0 ? (
                  <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-400">
                    {t('noPaymentsYet')}
                  </div>
                ) : (
                  <div className="mt-2 overflow-auto rounded-xl border border-slate-800">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-900/40 text-slate-300">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">{t('date')}</th>
                          <th className="text-left font-medium px-3 py-2">{t('monthColumn')}</th>
                          <th className="text-left font-medium px-3 py-2">{t('amount')}</th>
                          <th className="text-left font-medium px-3 py-2">{t('mode')}</th>
                          <th className="text-left font-medium px-3 py-2">{t('txn')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((p) => (
                          <tr key={p.id} className="border-t border-slate-800">
                            <td className="px-3 py-2">{p.payment_date}</td>
                            <td className="px-3 py-2">{p.month}</td>
                            <td className="px-3 py-2 font-medium">{formatINR(Number(p.amount_paid || 0))}</td>
                            <td className="px-3 py-2">{p.payment_mode}</td>
                            <td className="px-3 py-2">{p.transaction_id ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="text-sm text-slate-400">{t('studentNotFound')}</div>
      )}
    </Modal>
  )
}

function cleanPhoneRequired(v: FormDataEntryValue | null, requiredMessage: string, invalidMessage: string): string {
  const s = String(v || '')
    .replace(/\s+/g, '')
    .trim()
  if (!s) throw new Error(requiredMessage)
  if (!/^\d{10}$/.test(s)) throw new Error(invalidMessage)
  return s
}

function cleanPhoneOptional(v: FormDataEntryValue | null, invalidMessage: string): string | null {
  const s = String(v || '')
    .replace(/\s+/g, '')
    .trim()
  if (!s) return null
  if (!/^\d{10}$/.test(s)) throw new Error(invalidMessage)
  return s
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="sr-card-soft p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  )
}
