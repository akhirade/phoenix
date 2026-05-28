import { useEffect, useMemo, useState } from 'react'
import { useData } from '../lib/DataProvider'
import { dueDayFromISODate, todayISODate } from '../lib/utils'
import { useToast } from './ToastProvider'
import { Modal } from './Modal'
import { useI18n } from '../i18n/I18nProvider'

export function AddStudentSeatModal({
  open,
  seatNumber,
  onClose,
}: {
  open: boolean
  seatNumber: number | null
  onClose: () => void
}) {
  const { settings, students, upsertStudent } = useData()
  const toast = useToast()
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [mobile, setMobile] = useState('')
  const [parentContact, setParentContact] = useState('')
  const [joiningDate, setJoiningDate] = useState('')
  const [monthlyFee, setMonthlyFee] = useState<number | ''>('')
  const [dueDay, setDueDay] = useState<number | ''>('')
  const [notes, setNotes] = useState('')

  const joiningDefault = todayISODate()


  const selectedStudent = useMemo(
    () => (selectedStudentId ? students.find((s) => s.id === selectedStudentId) ?? null : null),
    [students, selectedStudentId],
  )

  const studentSuggestions = useMemo(() => {
    return students
      .slice()
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map((s) => {
        const parts = [s.full_name]
        if (s.mobile) parts.push(s.mobile)
        if (s.seat_number) parts.push(`${t('seatLabel', { n: s.seat_number })}`)
        const display = parts.join(' • ')
        return { id: s.id, display, student: s }
      })
  }, [students, t])

  const suggestionToStudent = useMemo(() => {
    const map = new Map<string, (typeof studentSuggestions)[number]>()
    for (const opt of studentSuggestions) map.set(opt.display, opt)
    return map
  }, [studentSuggestions])

  const formStateDefaults = useMemo(() => {
    const join = joiningDefault
    const due = dueDayFromISODate(join) ?? settings.defaultDueDay
    return {
      joiningDate: join,
      dueDay: due,
      monthlyFee: settings.defaultMonthlyFee,
    }
  }, [joiningDefault, settings.defaultDueDay, settings.defaultMonthlyFee])

  const seatOccupiedBy = useMemo(() => {
    if (!seatNumber) return null
    return (
      students.find((s) => s.status === 'Active' && s.seat_number === seatNumber) ?? null
    )
  }, [students, seatNumber])

  const effectiveJoiningDate = joiningDate || formStateDefaults.joiningDate
  const effectiveMonthlyFee = monthlyFee === '' ? formStateDefaults.monthlyFee : Number(monthlyFee)
  const derivedDue = dueDayFromISODate(effectiveJoiningDate) ?? settings.defaultDueDay
  const effectiveDueDay = dueDay === '' ? derivedDue : Number(dueDay)

  function resetFormState() {
    setSelectedStudentId(null)
    setFullName('')
    setMobile('')
    setParentContact('')
    setJoiningDate('')
    setMonthlyFee('')
    setDueDay('')
    setNotes('')
  }

  useEffect(() => {
    if (!open) return
    setError(null)
    resetFormState()
  }, [open, seatNumber])

  function onFullNameChange(next: string) {
    setError(null)
    const matched = suggestionToStudent.get(next)
    if (!matched) {
      setSelectedStudentId(null)
      setFullName(next)
      return
    }

    const s = matched.student
    setSelectedStudentId(s.id)
    setFullName(s.full_name)
    setMobile(s.mobile ?? '')
    setParentContact(s.parent_contact ?? '')
    setJoiningDate(s.joining_date ?? '')
    setMonthlyFee(s.monthly_fee ?? settings.defaultMonthlyFee)
    setDueDay(s.due_day ?? (dueDayFromISODate(s.joining_date || joiningDefault) ?? settings.defaultDueDay))
    setNotes(s.notes ?? '')
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!seatNumber) {
      setError(t('errSeatNumberMissing'))
      return
    }

    if (seatOccupiedBy) {
      setError(t('errSeatOccupiedBy', { seat: seatNumber, name: seatOccupiedBy.full_name }))
      return
    }

    setBusy(true)
    try {
      const name = String(fullName || '').trim()
      const phone = cleanPhoneRequired(mobile, t('errMobileRequired'), t('errMobile10Digits'))
      const parent = cleanPhoneOptional(parentContact, t('errParent10Digits'))
      const join = String(effectiveJoiningDate || '').trim() || joiningDefault
      const fee = Number(effectiveMonthlyFee || settings.defaultMonthlyFee)
      const due = Number(effectiveDueDay)
      const cleanedNotes = String(notes || '').trim() || null

      if (!name) throw new Error(t('errFullNameRequired'))
      if (due < 1 || due > 28) throw new Error(t('errDueDayRange28'))

      await upsertStudent({
        id: selectedStudentId ?? undefined,
        full_name: name,
        mobile: phone,
        parent_contact: parent,
        joining_date: join,
        seat_number: seatNumber,
        monthly_fee: fee,
        due_day: due,
        status: 'Active',
        notes: cleanedNotes,
      } as any)

      toast.success(selectedStudentId ? t('studentUpdated') : t('studentAdded'))
      resetFormState()
      onClose()
    } catch (err: any) {
      setError(err?.message || t('saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title={seatNumber ? `${t('addStudent')} (${t('seatLabel', { n: seatNumber })})` : t('addStudent')}
      subtitle={t('clickToAssign')}
      onClose={onClose}
    >
      {seatOccupiedBy ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
          {t('errSeatOccupiedBy', { seat: seatNumber, name: seatOccupiedBy.full_name })}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <form className="mt-3 space-y-3" onSubmit={onSubmit}>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            {t('fullName')} <span className="text-rose-400">*</span>
          </label>
          <input
            className="sr-input"
            name="full_name"
            required
            list="existing-students"
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            placeholder={t('existingStudentPlaceholder')}
            autoComplete="off"
          />
          <datalist id="existing-students">
            {studentSuggestions.map((opt) => (
              <option key={opt.id} value={opt.display} />
            ))}
          </datalist>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('existingStudentHint')}</div>
        </div>

        {selectedStudent && selectedStudent.seat_number && selectedStudent.seat_number !== seatNumber ? (
          <div className="rounded-xl border border-amber-600/30 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100 p-3 text-sm">
            {t('moveSeatWarning', { from: selectedStudent.seat_number, to: seatNumber })}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {t('mobileNumber')} <span className="text-rose-400">*</span>
            </label>
            <input
              className="sr-input"
              name="mobile"
              placeholder={t('phonePlaceholder10')}
              required
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('parentContact')}</label>
            <input
              className="sr-input"
              name="parent_contact"
              placeholder={t('phonePlaceholder10')}
              value={parentContact}
              onChange={(e) => setParentContact(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('joiningDate')}</label>
            <input
              className="sr-input"
              type="date"
              name="joining_date"
              value={effectiveJoiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('seat')}</label>
            <input className="sr-input" value={seatNumber ?? ''} disabled />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('monthlyFee')}</label>
            <input
              className="sr-input"
              type="number"
              min={0}
              name="monthly_fee"
              value={effectiveMonthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value === '' ? '' : Number(e.target.value))}
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
              value={effectiveDueDay}
              onChange={(e) => setDueDay(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">{t('notes')}</label>
          <textarea
            className="sr-textarea"
            name="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button type="button" className="sr-btn" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="sr-btn-primary disabled:opacity-60" disabled={busy || !!seatOccupiedBy}>
            {busy ? t('saving') : t('save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function cleanPhoneRequired(v: FormDataEntryValue | null, requiredMessage: string, invalidMessage: string): string {
  const s = String(v || '').replace(/\s+/g, '').trim()
  if (!s) throw new Error(requiredMessage)
  if (!/^\d{10}$/.test(s)) throw new Error(invalidMessage)
  return s
}

function cleanPhoneOptional(v: FormDataEntryValue | null, invalidMessage: string): string | null {
  const s = String(v || '').replace(/\s+/g, '').trim()
  if (!s) return null
  if (!/^\d{10}$/.test(s)) throw new Error(invalidMessage)
  return s
}
