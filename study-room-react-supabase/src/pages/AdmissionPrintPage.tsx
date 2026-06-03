import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../lib/DataProvider'
import { useI18n } from '../i18n/I18nProvider'
import { formatLocalDate, formatLocalDateTime } from '../lib/utils'

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function AdmissionPrintPage() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const { students, settings } = useData()
  const { t, locale } = useI18n()
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [sharing, setSharing] = useState(false)

  const intlLocale = locale === 'mr' ? 'mr-IN' : 'en-IN'

  const student = useMemo(
    () => (studentId ? students.find((s) => s.id === studentId) ?? null : null),
    [students, studentId],
  )

  const terms = (settings.admissionTerms ?? '').trim()

  useEffect(() => {
    const prev = document.title
    const center = (settings.centerName || t('appName')).trim()
    const name = (student?.full_name || '').trim()
    document.title = name ? `${center} — ${t('admissionFormTitle')} — ${name}` : `${center} — ${t('admissionFormTitle')}`
    return () => {
      document.title = prev
    }
  }, [settings.centerName, student?.full_name, t])

  if (!student) {
    return <div className="text-sm text-slate-400">{t('studentNotFound')}</div>
  }

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/dashboard')
  }

  const closePage = () => {
    try {
      window.close()
    } catch {
      // ignore
    }
    // If the browser blocks window.close(), fall back.
    window.setTimeout(() => goBack(), 50)
  }

  const sharePdf = async () => {
    const el = contentRef.current
    if (!el || sharing) return

    setSharing(true)
    try {
      const canvas = await html2canvas(el, {
        scale: Math.min(2, window.devicePixelRatio || 1),
        useCORS: true,
        backgroundColor: '#ffffff',
      })

      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      // Fit entire content onto a single A4 page (no splitting).
      const scale = Math.min(pageWidth / canvas.width, pageHeight / canvas.height)
      const imgWidth = canvas.width * scale
      const imgHeight = canvas.height * scale
      const x = (pageWidth - imgWidth) / 2
      const y = (pageHeight - imgHeight) / 2

      pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight)

      const blob = pdf.output('blob')
      const safeName = (student.full_name || 'Student').trim().replace(/\s+/g, ' ')
      const filename = `Admission Form - ${safeName}.pdf`
      const file = new File([blob], filename, { type: 'application/pdf' })

      const canShareFiles =
        typeof navigator !== 'undefined' &&
        'canShare' in navigator &&
        typeof (navigator as any).canShare === 'function' &&
        (navigator as any).canShare({ files: [file] })

      if (typeof navigator !== 'undefined' && 'share' in navigator && canShareFiles) {
        await (navigator as any).share({
          title: document.title,
          files: [file],
        })
      } else {
        downloadBlob(blob, filename)
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="sr-card p-4 sr-print">
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div>
          <div className="sr-title">{t('admissionFormTitle')}</div>
          <div className="sr-subtitle">{student.full_name}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            className="sr-btn"
            type="button"
            onClick={sharePdf}
            disabled={sharing}
            aria-label="Share PDF"
            title="Share PDF"
          >
            <ShareIcon className="h-5 w-5" />
          </button>
          <button className="sr-btn" type="button" onClick={closePage}>
            {t('close')}
          </button>
          <button className="sr-btn-primary" type="button" onClick={() => window.print()}>
            {t('print')}
          </button>
        </div>
      </div>

      <div className="mt-3" ref={contentRef}>
        <div className="text-center">
          <div className="text-lg font-semibold">{settings.centerName || t('appName')}</div>
          {settings.centerAddress ? (
            <div className="mt-1 text-sm whitespace-pre-wrap break-words text-slate-600 dark:text-slate-400">
              {settings.centerAddress}
            </div>
          ) : null}
          {settings.centerPhone ? (
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{settings.centerPhone}</div>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm sr-print-grid">
          <Field label={t('fullName')} value={student.full_name} />
          <Field label={t('mobile')} value={student.mobile ?? '-'} />
          <Field label={t('email')} value={student.email ?? '-'} />
          <Field label={t('birthDate')} value={formatLocalDate(student.birth_date, intlLocale)} />
          <Field label={t('gender')} value={student.gender ?? '-'} />
          <Field label={t('emergencyContact')} value={student.emergency_contact ?? '-'} />
          <Field label={t('preparingExam')} value={student.preparing_exam ?? '-'} />
          <Field label={t('firstPaymentReceiptNo')} value={student.first_payment_receipt_no ?? '-'} />
          <Field label={t('idProof')} value={student.id_proof ?? '-'} />
          <Field label={t('joiningDate')} value={student.joining_date ?? '-'} />
        </div>

        <div className="mt-3">
          <div className="text-xs text-slate-600 dark:text-slate-400">{t('address')}</div>
          <div className="mt-1 rounded-xl border border-slate-200 bg-white/60 p-3 whitespace-pre-wrap break-words text-sm dark:border-slate-800 dark:bg-slate-900/30 sr-print-block sr-print-avoid-break">
            {student.address ?? '-'}
          </div>
        </div>

        {terms ? (
          <div className="mt-4">
            <div className="font-medium text-sm">{t('termsAndConditions')}</div>
            <div className="mt-2 rounded-xl border border-slate-200 bg-white/60 p-3 whitespace-pre-wrap break-words text-sm dark:border-slate-800 dark:bg-slate-900/30 sr-print-block sr-print-terms">
              {terms}
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Field label={t('signatureName')} value={student.admission_signature_name ?? '-'} />
          <Field label={t('submittedAt')} value={formatLocalDateTime(student.admission_submitted_at, intlLocale)} />
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="sr-card-soft p-3 sr-print-block sr-print-avoid-break">
      <div className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-400">{label}</div>
      <div className="mt-1">{value}</div>
    </div>
  )
}
