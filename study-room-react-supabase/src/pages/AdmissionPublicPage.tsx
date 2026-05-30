import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import { supabase } from '../lib/supabase'

type AdmissionContext = {
  student: {
    id: string
    full_name: string | null
    mobile: string | null
    email: string | null
    address: string | null
    birth_date: string | null
    gender: string | null
    emergency_contact: string | null
    preparing_exam: string | null
    first_payment_receipt_no: string | null
    id_proof: string | null
    joining_date: string | null
  }
  center: {
    name: string
    address: string
    phone: string
  }
  terms: string
}

export function AdmissionPublicPage() {
  const { token } = useParams()
  const { t } = useI18n()

  const [ctx, setCtx] = useState<AdmissionContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const center = ctx?.center

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        if (!token) throw new Error(t('errInvalidLink'))
        const { data, error } = await supabase.rpc('get_admission_context', { p_token: token })
        if (error) throw error

        const parsed = data as unknown as AdmissionContext
        if (!parsed?.student?.id) throw new Error(t('errInvalidLink'))

        if (!cancelled) setCtx(parsed)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : t('errInvalidLink')
        if (!cancelled) setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [token, t])

  const termsLines = useMemo(() => {
    const raw = ctx?.terms ?? ''
    return raw.split('\n').map((s) => s.trimEnd()).filter(Boolean)
  }, [ctx?.terms])


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <div className="sr-card p-5">
          <div className="text-lg font-semibold">{t('admissionFormTitle')}</div>

          {center ? (
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              <div className="font-medium">{center.name}</div>
              {center.address ? <div className="whitespace-pre-line">{center.address}</div> : null}
              {center.phone ? <div>{center.phone}</div> : null}
            </div>
          ) : null}

          {loading ? <div className="mt-4 text-sm text-slate-400">{t('loading')}</div> : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-900 dark:text-rose-100">
              {error}
            </div>
          ) : null}

          {!loading && !error && ctx ? (
            <AdmissionPublicForm
              key={ctx.student.id}
              token={token ?? ''}
              ctx={ctx}
              termsLines={termsLines}
              onError={setError}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function AdmissionPublicForm({
  token,
  ctx,
  termsLines,
  onError,
}: {
  token: string
  ctx: AdmissionContext
  termsLines: string[]
  onError: (msg: string | null) => void
}) {
  const { t } = useI18n()

  const student = ctx.student

  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [fullName, setFullName] = useState(student.full_name ?? '')
  const [mobile, setMobile] = useState(student.mobile ?? '')
  const [email, setEmail] = useState(student.email ?? '')
  const [birthDate, setBirthDate] = useState(student.birth_date ?? '')
  const [gender, setGender] = useState(student.gender ?? '')
  const [address, setAddress] = useState(student.address ?? '')
  const [emergencyContact, setEmergencyContact] = useState(student.emergency_contact ?? '')
  const [preparingExam, setPreparingExam] = useState(student.preparing_exam ?? '')
  const [firstPaymentReceiptNo, setFirstPaymentReceiptNo] = useState(student.first_payment_receipt_no ?? '')
  const [idProof, setIdProof] = useState(student.id_proof ?? '')
  const [signatureName, setSignatureName] = useState(student.full_name ?? '')
  const [acceptTerms, setAcceptTerms] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onError(null)
    setBusy(true)

    try {
      if (!token) throw new Error(t('errInvalidLink'))
      if (!fullName.trim()) throw new Error(t('errFullNameRequired'))
      const mobileClean = mobile.replace(/\D+/g, '').trim()
      if (!/^\d{10}$/.test(mobileClean)) throw new Error(t('errMobile10Digits'))
      if (!address.trim()) throw new Error(t('errAddressRequired'))
      if (!gender.trim()) throw new Error(t('errGenderRequired'))
      if (!acceptTerms) throw new Error(t('errAcceptTerms'))

      const { error } = await supabase.rpc('submit_admission_form', {
        p_token: token,
        p_full_name: fullName.trim(),
        p_birth_date: birthDate || null,
        p_gender: gender || null,
        p_mobile: mobileClean,
        p_email: email.trim() || null,
        p_address: address.trim() || null,
        p_emergency_contact: emergencyContact.trim() || null,
        p_preparing_exam: preparingExam.trim() || null,
        p_first_payment_receipt_no: firstPaymentReceiptNo.trim() || null,
        p_id_proof: idProof.trim() || null,
        p_signature_name: signatureName.trim() || null,
        p_accept_terms: true,
      })
      if (error) throw error

      setSubmitted(true)
    } catch (e: unknown) {
      const anyErr = e as any
      const raw = String((anyErr && anyErr.message) || '')
      const isDupMobile =
        anyErr?.code === '23505' ||
        /students_mobile_unique/i.test(raw) ||
        /mobile number already used/i.test(raw)

      const msg = isDupMobile
        ? t('errMobileAlreadyUsedGeneric')
        : e instanceof Error
          ? e.message
          : t('errSubmitFailed')

      onError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-100">
        {t('admissionSubmittedThanks')}
      </div>
    )
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={onSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
            {t('fullName')} <span className="text-rose-400">*</span>
          </label>
          <input className="sr-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
            {t('mobile')} <span className="text-rose-400">*</span>
          </label>
          <input
            className="sr-input"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            inputMode="numeric"
            pattern="\\d{10}"
            maxLength={10}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('email')}</label>
          <input
            className="sr-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('birthDate')}</label>
          <input className="sr-input" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} type="date" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('gender')}</label>
        <select className="sr-select" value={gender} onChange={(e) => setGender(e.target.value)} required>
          <option value="">{t('select')}</option>
          <option value="Male">{t('male')}</option>
          <option value="Female">{t('female')}</option>
          <option value="Other">{t('other')}</option>
        </select>
      </div>

      <div>
        <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('address')}</label>
        <textarea className="sr-textarea" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} required />
      </div>

      <div>
        <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('emergencyContact')}</label>
        <input
          className="sr-input"
          value={emergencyContact}
          onChange={(e) => setEmergencyContact(e.target.value)}
          placeholder={t('emergencyContactPlaceholder')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('preparingExam')}</label>
          <input className="sr-input" value={preparingExam} onChange={(e) => setPreparingExam(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('firstPaymentReceiptNo')}</label>
          <input className="sr-input" value={firstPaymentReceiptNo} onChange={(e) => setFirstPaymentReceiptNo(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('idProof')}</label>
        <input className="sr-input" value={idProof} onChange={(e) => setIdProof(e.target.value)} />
      </div>

      {termsLines.length ? (
        <div className="rounded-xl border border-slate-200 bg-white/60 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/30">
          <div className="font-medium text-sm">{t('termsAndConditions')}</div>
          <div className="mt-2 space-y-1 text-slate-700 dark:text-slate-200">
            {termsLines.map((line, idx) => (
              <div key={idx} className="whitespace-pre-line">
                {line}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
        />
        <span>{t('acceptTerms')}</span>
      </label>

      <div>
        <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('signatureName')}</label>
        <input className="sr-input" value={signatureName} onChange={(e) => setSignatureName(e.target.value)} />
      </div>

      <button className="w-full sr-btn-primary disabled:opacity-60" type="submit" disabled={busy}>
        {busy ? t('saving') : t('submitAdmission')}
      </button>
    </form>
  )
}
