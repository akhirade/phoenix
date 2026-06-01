import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/DataProvider'
import { dueDayFromISODate, formatINR, formatLocalDate, formatLocalDateTime, monthKeyFromDate, seatNumbers, todayISODate } from '../lib/utils'
import type { Payment, Student } from '../lib/types'
import { Modal } from './Modal'
import { Tag } from './Tag'
import { useToast } from './ToastProvider'
import { useI18n } from '../i18n/I18nProvider'

export function StudentProfileModal({
  open,
  studentId,
  initialMode,
  initialFocusField,
  prefillStatus,
  onClose,
}: {
  open: boolean
  studentId: string | null
  initialMode?: 'profile' | 'edit'
  initialFocusField?: 'seat' | null
  prefillStatus?: 'Active' | 'Inactive'
  onClose: () => void
}) {
  const { students, settings, upsertStudent, ensureAdmissionLink, refreshStudent, listPaymentsByStudent } = useData()
  const toast = useToast()
  const { t, locale } = useI18n()

  const intlLocale = locale === 'mr' ? 'mr-IN' : 'en-IN'

  const [mode, setMode] = useState<'profile' | 'edit'>('profile')
  const [focusField, setFocusField] = useState<'seat' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [studentPayments, setStudentPayments] = useState<Payment[]>([])
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

  useEffect(() => {
    let cancelled = false
    if (!open || !studentId) return

    listPaymentsByStudent(studentId)
      .then((rows) => {
        if (cancelled) return
        setStudentPayments(rows)
      })
      .catch(() => {
        if (cancelled) return
        setStudentPayments([])
      })

    return () => {
      cancelled = true
    }
  }, [open, studentId, listPaymentsByStudent])

  const history = useMemo(() => {
    if (!studentId) return []
    return studentPayments
  }, [studentId, studentPayments])

  const current = useMemo(() => {
    if (!studentId) return null
    const paid = studentPayments
      .filter((p) => p.month === monthKey)
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
  }, [studentPayments, studentId, monthKey, student?.monthly_fee, settings.defaultMonthlyFee, t])

  const activation = useMemo(() => {
    if (!student) return null
    if (!student.admission_submitted_at) return null

    const hasSeat = student.status === 'Active' && Number(student.seat_number)
    const fee = Number(student.monthly_fee ?? settings.defaultMonthlyFee)
    const hasFee = fee > 0
    const paidThisMonth = hasFee && (current?.due ?? Number.POSITIVE_INFINITY) <= 0

    return {
      hasSeat,
      hasFee,
      paidThisMonth,
    }
  }, [student, current?.due, settings.defaultMonthlyFee])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      setMode(initialMode ?? 'profile')
      setFocusField(initialFocusField ?? null)
      setBusy(false)
      setError(null)
    }, 0)
    return () => window.clearTimeout(id)
  }, [open, studentId, initialMode, initialFocusField])

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
          {/** Friendly ID display */}
          
          {mode === 'edit' ? (
            <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-3 text-sm text-slate-900 dark:text-slate-100">
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

                  const mobileClean = String(mobile || '').replace(/\D+/g, '').trim()
                  const dupMobile = students.find(
                    (s) => s.id !== student.id && String(s.mobile || '').replace(/\D+/g, '').trim() === mobileClean,
                  )
                  if (dupMobile) throw new Error(t('errMobileAlreadyUsed', { name: dupMobile.full_name }))

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
                  const anyErr = err as any
                  const raw =
                    String(anyErr?.message || '') +
                    ' ' +
                    String(anyErr?.details || '') +
                    ' ' +
                    String(anyErr?.hint || '')

                  const code = String(anyErr?.code || anyErr?.error?.code || '')
                  const isDupMobile =
                    code === '23505' &&
                    (/students_mobile_unique/i.test(raw) || /mobile number already used/i.test(raw) || /duplicate key value/i.test(raw))

                  const msg = isDupMobile
                    ? t('errMobileAlreadyUsedGeneric')
                    : err instanceof Error
                      ? err.message
                      : t('errFailedUpdateStudent')
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
                <textarea className="sr-textarea" name="address" rows={3} defaultValue={student.address ?? ''} />
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
                  <select
                    className="sr-select"
                    name="status"
                    defaultValue={prefillStatus ?? (student.status ?? 'Active')}
                    onChange={(e) => {
                      if (e.currentTarget.value === 'Active') setFocusField('seat')
                    }}
                  >
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
              {(() => {
                const shortId = `S-${String(student.id).slice(0, 8)}`
                const displayId = (student.student_code ?? '').trim() || shortId
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Info
                      label={t('studentId')}
                      value={
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 font-semibold truncate" title={student.id}>
                            {displayId}
                          </div>
                          <button
                            className="sr-btn-sm shrink-0"
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(String(student.id))
                                toast.success('Copied')
                              } catch {
                                toast.error('Copy failed')
                              }
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      }
                    />
                    <Info label={t('mobile')} value={student.mobile ?? '-'} />
                    <Info label={t('parent')} value={student.parent_contact ?? '-'} />
                  </div>
                )
              })()}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Info label={t('seat')} value={student.seat_number ? String(student.seat_number) : '-'} />
                <Info label={t('joiningDate')} value={formatLocalDate(student.joining_date, intlLocale)} />
                <Info
                  label={t('status')}
                  value={
                    <Tag kind={student.status === 'Active' ? 'good' : 'bad'}>
                      {student.status === 'Active' ? t('active') : t('inactive')}
                    </Tag>
                  }
                />
              </div>

              <Accordion
                title={t('admissionForm')}
                defaultOpen
                right={
                  <Tag kind={student.admission_submitted_at ? 'good' : 'warn'}>
                    {student.admission_submitted_at ? t('admissionSubmitted') : t('admissionNotSubmitted')}
                  </Tag>
                }
              >
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {t('admissionLinkExpires')}{' '}
                  <span className="text-slate-900 dark:text-slate-200">
                    {student.admission_token_expires_at
                      ? formatLocalDateTime(student.admission_token_expires_at, intlLocale)
                      : t('admissionNoActiveLink')}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                  {activation && (!activation.hasSeat || !activation.paidThisMonth) ? (
                    <button
                      className="sr-btn shrink-0"
                      type="button"
                      onClick={() => {
                        setMode('edit')
                        setFocusField('seat')
                      }}
                    >
                      {t('startActivation')}
                    </button>
                  ) : null}

                  <button
                    className="sr-btn shrink-0"
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
                    className="sr-btn shrink-0"
                    type="button"
                    onClick={async () => {
                      try {
                        const token = await ensureAdmissionLink(student.id)
                        const base = new URL(import.meta.env.BASE_URL || '/', window.location.origin)
                        const url = new URL(`admission/${token}`, base).toString()
                        await navigator.clipboard.writeText(url)
                        toast.success(t('admissionLinkRegenerated'))
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : 'Failed'
                        toast.error(msg)
                      }
                    }}
                  >
                    {t('regenerateAdmissionLink')}
                  </button>

                  <button
                    className="sr-btn shrink-0"
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

                  <button
                    className="sr-btn-primary shrink-0"
                    type="button"
                    onClick={async () => {
                      try {
                        const digits = String(student.mobile ?? '').replace(/\D+/g, '').trim()
                        const raw = digits.length >= 10 ? digits.slice(-10) : ''
                        if (!/^\d{10}$/.test(raw)) throw new Error(t('errMobile10Digits'))

                        const token = getValidAdmissionToken(student) ?? (await ensureAdmissionLink(student.id))
                        const base = new URL(import.meta.env.BASE_URL || '/', window.location.origin)
                        const link = new URL(`admission/${token}`, base).toString()

                        const text = `${(settings.centerName || t('appName')).trim()}\nAdmission Form Link:\n${link}`
                        const wa = `https://wa.me/91${raw}?text=${encodeURIComponent(text)}`
                        window.open(wa, '_blank', 'noopener,noreferrer')
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : 'Failed'
                        toast.error(msg)
                      }
                    }}
                  >
                    {t('sendWhatsApp')}
                  </button>

                  <Link className="sr-btn shrink-0" to={`/admission/print/${student.id}`} onClick={onClose}>
                    {t('printAdmissionForm')}
                  </Link>
                </div>

                {activation ? (
                  <div className="mt-3 sr-card-soft p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{t('activationChecklist')}</div>
                      {activation.hasSeat && activation.hasFee && activation.paidThisMonth ? (
                        <Tag kind="good">{t('activationComplete')}</Tag>
                      ) : (
                        <Tag kind="warn">{t('activationPending')}</Tag>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <Info label={t('checkSeatAssigned')} value={activation.hasSeat ? t('done') : t('pending')} />
                      <Info label={t('checkPaymentThisMonth', { month: monthKey })} value={activation.paidThisMonth ? t('done') : t('pending')} />
                    </div>
                  </div>
                ) : null}

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
                  <Info
                    label={t('address')}
                    value={<div className="whitespace-pre-line break-words">{student.address ?? '-'}</div>}
                  />
                </div>
              </Accordion>

              <div className="sr-card p-3">
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

              <Accordion title={t('paymentHistory')} defaultOpen={false}>
                {history.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">{t('noPaymentsYet')}</div>
                ) : (
                  <div className="sr-table-wrap">
                    <table className="sr-table">
                      <thead className="sr-thead">
                        <tr>
                          <th className="sr-th whitespace-nowrap">{t('date')}</th>
                          <th className="sr-th whitespace-nowrap">{t('monthColumn')}</th>
                          <th className="sr-th">{t('amount')}</th>
                          <th className="sr-th">{t('mode')}</th>
                          <th className="sr-th">{t('txn')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((p) => (
                          <tr key={p.id} className="border-t border-slate-200 dark:border-slate-800">
                            <td className="sr-td whitespace-nowrap">{formatLocalDate(p.payment_date, intlLocale)}</td>
                            <td className="sr-td whitespace-nowrap">{p.month}</td>
                            <td className="sr-td whitespace-nowrap font-medium">{formatINR(Number(p.amount_paid || 0))}</td>
                            <td className="sr-td whitespace-nowrap">{p.payment_mode}</td>
                            <td className="sr-td whitespace-nowrap">{p.transaction_id ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Accordion>
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

function Accordion({
  title,
  right,
  defaultOpen,
  children,
}: {
  title: string
  right?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen))

  return (
    <details
      className="sr-card p-3 group"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex items-center justify-between gap-3 cursor-pointer select-none [&::-webkit-details-marker]:hidden">
        <div className="font-medium text-sm">{title}</div>
        <div className="shrink-0 inline-flex items-center gap-2">
          {right ? <div>{right}</div> : null}
          <span
            className="inline-block text-slate-500 dark:text-slate-400 transition-transform group-open:rotate-90"
            aria-hidden="true"
          >
            ▸
          </span>
        </div>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}
