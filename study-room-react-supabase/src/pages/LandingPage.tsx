import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/ToastProvider'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n/I18nProvider'

export function LandingPage() {
  const toast = useToast()
  const { locale, toggleLocale, t } = useI18n()

  const envOk = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  const year = new Date().getFullYear()

  const facilities = useMemo(
    () =>
      [
        { id: 'seat' as const, kind: 'sky' as const, icon: <IconSeat />, title: t('landingFacilitySeatTitle'), detail: t('landingFacilitySeatDetail') },
        { id: 'quiet' as const, kind: 'sky' as const, icon: <IconQuiet />, title: t('landingFacilityQuietTitle'), detail: t('landingFacilityQuietDetail') },
        { id: 'lighting' as const, kind: 'amber' as const, icon: <IconLamp />, title: t('landingFacilityLightingTitle'), detail: t('landingFacilityLightingDetail') },
        { id: 'clean' as const, kind: 'emerald' as const, icon: <IconSpark />, title: t('landingFacilityCleanTitle'), detail: t('landingFacilityCleanDetail') },
        { id: 'charging' as const, kind: 'amber' as const, icon: <IconBolt />, title: t('landingFacilityChargingTitle'), detail: t('landingFacilityChargingDetail') },
        { id: 'rules' as const, kind: 'sky' as const, icon: <IconCheck />, title: t('landingFacilityRulesTitle'), detail: t('landingFacilityRulesDetail') },
      ] as const,
    [t],
  )

  const highlights = useMemo(
    () =>
      [
        { id: 'comfort' as const, title: t('landingHighlightComfort'), detail: t('landingHighlightComfortDetail') },
        { id: 'discipline' as const, title: t('landingHighlightDiscipline'), detail: t('landingHighlightDisciplineDetail') },
        { id: 'process' as const, title: t('landingHighlightProcess'), detail: t('landingHighlightProcessDetail') },
        { id: 'transparent' as const, title: t('landingHighlightTransparent'), detail: t('landingHighlightTransparentDetail') },
      ] as const,
    [t],
  )

  const plans = useMemo(
    () =>
      [
        {
          id: 'monthly' as const,
          title: t('landingMonthlyPlanTitle'),
          detail: t('landingMonthlyPlanDetail'),
          tag: t('landingTagMostPopular'),
          tagKind: 'emerald' as const,
          bestFor: t('landingPlanMonthlyBestFor'),
          renewal: t('landingPlanMonthlyRenewal'),
          extras: [t('landingPlanMonthlyExtra1'), t('landingPlanMonthlyExtra2')],
        },
        {
          id: 'yearly' as const,
          title: t('landingYearlyPlanTitle'),
          detail: t('landingYearlyPlanDetail'),
          tag: t('landingTagBestValue'),
          tagKind: 'amber' as const,
          bestFor: t('landingPlanYearlyBestFor'),
          renewal: t('landingPlanYearlyRenewal'),
          extras: [t('landingPlanYearlyExtra1'), t('landingPlanYearlyExtra2')],
        },
      ] as const,
    [t],
  )

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function handlePhoneChange(raw: string) {
    const digits = raw.replace(/\D+/g, '').slice(0, 10)
    setPhone(digits)
    if (digits.length > 0 && digits.length < 10) {
      setPhoneError(`Must be 10 digits (${digits.length}/10 entered)`)
    } else {
      setPhoneError(null)
    }
  }

  const canSubmit = useMemo(() => {
    if (!envOk) return false
    if (!fullName.trim()) return false
    if (phone.length !== 10) return false
    if (!message.trim()) return false
    return true
  }, [envOk, fullName, phone, message])

  const [highlightIndex, setHighlightIndex] = useState(0)
  const highlightCount = highlights.length

  const [centerAddress, setCenterAddress] = useState<string | null>(null)
  const [centerName, setCenterName] = useState<string | null>(null)
  const [centerPhone, setCenterPhone] = useState<string | null>(null)
  const [galleryImages, setGalleryImages] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('id', 'default')
          .maybeSingle()
        const val = data?.value as any
        console.log('[LandingPage] Fetched app_settings:', val)
        if (val?.centerAddress) setCenterAddress(String(val.centerAddress))
        if (val?.centerName) setCenterName(String(val.centerName))
        if (val?.centerPhone) setCenterPhone(String(val.centerPhone))
        if (Array.isArray(val?.galleryImages) && val.galleryImages.length > 0) {
          console.log('[LandingPage] Setting gallery images:', val.galleryImages)
          setGalleryImages(val.galleryImages)
        } else {
          console.log('[LandingPage] No gallery images found')
        }
      } catch (err) {
        console.error('[LandingPage] Error loading settings:', err)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (highlightCount <= 1) return

    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (mql?.matches) return

    const t = window.setInterval(() => {
      setHighlightIndex((i) => (i + 1) % highlightCount)
    }, 4200)

    return () => {
      window.clearInterval(t)
    }
  }, [highlightCount])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return

    setBusy(true)
    try {
      const payload = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        message: message.trim(),
        source: 'landing',
      }

      const { error } = await supabase.from('contact_messages').insert(payload)
      if (error) {
        const hint =
          error.code === '42P01'
            ? 'Contact form is not set up in Supabase yet (missing table).'
            : error.code === '42501'
              ? 'Permission denied (RLS policy).'
              : ''
        const suffix = hint ? ` ${hint}` : ''
        toast.error(`${error.message}${suffix}`)
        return
      }

      setFullName('')
      setPhone('')
      setEmail('')
      setMessage('')
      toast.success(t('landingEnquiryThanks'))
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err && typeof (err as any).message === 'string'
            ? String((err as any).message)
            : 'Could not submit'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl dark:bg-sky-400/10" />
        <div className="absolute -bottom-40 left-10 h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-400/10" />
        <div className="absolute top-24 right-10 h-[420px] w-[420px] rounded-full bg-amber-500/10 blur-3xl dark:bg-amber-400/10" />
      </div>

      <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-slate-50/80 backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <PhoenixLogo className="h-8 w-8 shrink-0 text-rose-600" />
            <div className="min-w-0">
              <Link to="/" className="inline-flex text-base font-semibold leading-tight hover:opacity-90">
                {centerName ?? t('appName')}
              </Link>
              <div className="text-xs text-slate-600 dark:text-slate-400">{t('landingLocation')}</div>
              {centerPhone ? (
                <a
                  href={`tel:${centerPhone.replace(/[^\d+]/g, '')}`}
                  className="text-xs text-sky-700 hover:underline dark:text-sky-300"
                >
                  {centerPhone}
                </a>
              ) : null}
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <a className="sr-btn hidden sm:inline-flex" href="#facilities">
              {t('landingNavFacilities')}
            </a>
            <a className="sr-btn hidden sm:inline-flex" href="#plans">
              {t('landingNavPlans')}
            </a>
            <a className="sr-btn" href="#contact">
              {t('landingNavEnquiry')}
            </a>
            <button className="sr-btn" type="button" onClick={toggleLocale} aria-label={t('landingToggleLanguage')}>
              {locale === 'en' ? t('langEnglish') : t('langMarathi')}
            </button>
            <Link className="sr-btn" to="/login">
              {t('loginTitle')}
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative px-4 pb-12">
        <div className="mx-auto w-full max-w-6xl">
          <section className="pt-10 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <div className="sr-card p-6 relative overflow-hidden">
              <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-500/10 blur-2xl dark:bg-sky-400/10" />
              <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-2xl dark:bg-emerald-400/10" />

              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500/60" />
                {t('landingEnquiriesOpen')}
              </div>

              <div className="relative mt-4">
                <div className="text-3xl sm:text-4xl font-semibold tracking-tight">Study. Focus. Achieve.</div>
                <div className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">{t('landingHeroSubtitle')}</div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <a className="sr-btn-primary" href="#contact">
                    {t('landingCtaEnquireNow')}
                  </a>
                  <a className="sr-btn" href="#facilities">
                    {t('landingCtaSeeFacilities')}
                  </a>
                </div>

                <div className="mt-5">
                  <HeroMosaic images={galleryImages} />
                </div>
              </div>
            </div>

            <div className="sr-card-soft p-6 relative overflow-hidden">
              <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sky-500/10 blur-2xl dark:bg-sky-400/10" />
              <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-2xl dark:bg-emerald-400/10" />

              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="sr-title">{t('landingQuickHighlights')}</div>
                    <div className="sr-subtitle">{t('landingQuickHighlightsSubtitle')}</div>
                  </div>

                  <div className="hidden sm:flex items-center gap-2">
                    <button
                      type="button"
                      className="sr-btn-sm"
                      onClick={() => setHighlightIndex((i) => (i - 1 + highlightCount) % highlightCount)}
                      aria-label="Previous highlight"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="sr-btn-sm"
                      onClick={() => setHighlightIndex((i) => (i + 1) % highlightCount)}
                      aria-label="Next highlight"
                    >
                      ›
                    </button>
                  </div>
                </div>

                {/* Mobile carousel */}
                <div className="mt-4 sm:hidden">
                  <div className="sr-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{highlights[highlightIndex]?.title}</div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{highlights[highlightIndex]?.detail}</div>
                      </div>
                      <div className="shrink-0">
                        <IconBadge kind="sky" icon={<IconSpark />} />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1">
                        {highlights.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setHighlightIndex(idx)}
                            aria-label={`Go to highlight ${idx + 1}`}
                            className={
                              'h-2 w-2 rounded-full ' +
                              (idx === highlightIndex ? 'bg-sky-600/70 dark:bg-sky-400/70' : 'bg-slate-300 dark:bg-slate-700')
                            }
                          />
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="sr-btn-sm"
                          onClick={() => setHighlightIndex((i) => (i - 1 + highlightCount) % highlightCount)}
                          aria-label="Previous highlight"
                        >
                          {t('landingPrev')}
                        </button>
                        <button
                          type="button"
                          className="sr-btn-sm"
                          onClick={() => setHighlightIndex((i) => (i + 1) % highlightCount)}
                          aria-label="Next highlight"
                        >
                          {t('landingNext')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop grid */}
                <div className="mt-4 hidden sm:grid grid-cols-2 gap-3">
                  {highlights.map((h) => (
                    <HighlightCard key={h.title} title={h.title} detail={h.detail} />
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                  {t('landingHighlightsNote')}
                </div>
              </div>
            </div>
          </section>

          <section id="facilities" className="pt-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-2xl font-semibold">{t('landingFacilitiesTitle')}</div>
                <div className="sr-subtitle">{t('landingFacilitiesSubtitle')}</div>
              </div>
              <a className="sr-btn" href="#contact">
                {t('landingFacilitiesAction')}
              </a>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {facilities.map((f) => (
                <FacilityCard key={f.id} kind={f.kind} icon={f.icon} title={f.title} detail={f.detail} />
              ))}
            </div>
          </section>

          <section id="plans" className="pt-10">
            <div>
              <div className="text-2xl font-semibold">{t('landingPlansTitle')}</div>
              <div className="sr-subtitle">{t('landingPlansSubtitle')}</div>
            </div>

            <div className="mt-4">
              <div className="mx-auto w-full max-w-5xl">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {plans.map((p) => (
                    <div
                      key={p.title}
                      className={
                        'sr-card p-6 relative overflow-hidden transition-transform hover:-translate-y-0.5 ' +
                        (p.tagKind === 'emerald'
                          ? 'ring-1 ring-emerald-500/25 dark:ring-emerald-400/25'
                          : 'ring-1 ring-amber-500/25 dark:ring-amber-400/25')
                      }
                    >
                      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-500/10 blur-2xl dark:bg-sky-400/10" />
                      <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-amber-500/10 blur-2xl dark:bg-amber-400/10" />

                      <div className="relative flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-lg font-semibold">{p.title}</div>
                              <div
                                className={
                                  'rounded-full border px-3 py-1 text-xs ' +
                                  (p.tagKind === 'emerald'
                                    ? 'border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200'
                                    : 'border-amber-600/30 bg-amber-500/10 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200')
                                }
                              >
                                {p.tag}
                              </div>
                            </div>

                            <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">{p.detail}</div>

                            <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-sm leading-5 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                              <div className="flex flex-wrap items-center gap-x-2 whitespace-nowrap">
                                <span className="text-slate-600 dark:text-slate-400">{t('landingPlanMetaBestFor')}:</span>
                                <span className="font-medium text-slate-800 dark:text-slate-200">{p.bestFor}</span>
                                <span className="mx-1 text-slate-400 dark:text-slate-600">•</span>
                                <span className="text-slate-600 dark:text-slate-400">{t('landingPlanMetaRenewal')}:</span>
                                <span className="font-medium text-slate-800 dark:text-slate-200">{p.renewal}</span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 hidden xl:block">
                            <PlanIllustration />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <PlanFeature icon={<IconCheck />} text={t('landingPlanFeatureSeat')} />
                          <PlanFeature icon={<IconCheck />} text={t('landingPlanFeatureFocus')} />
                          <PlanFeature icon={<IconCheck />} text={t('landingPlanFeatureClean')} />
                          <PlanFeature icon={<IconCheck />} text={t('landingPlanFeatureSimple')} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <PlanFeature icon={<IconArrow />} text={p.extras[0]} />
                          <PlanFeature icon={<IconArrow />} text={p.extras[1]} />
                        </div>

                        <div className="text-sm text-slate-600 dark:text-slate-400">{t('landingPlanFeesNote')}</div>

                        <a className="inline-flex sr-btn-primary" href="#contact">
                          {t('landingPlanCtaFees')}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="pt-10">
            <div className="sr-card-soft p-6">
              <div className="text-2xl font-semibold">{t('landingHowTitle')}</div>
              <div className="sr-subtitle">{t('landingHowSubtitle')}</div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <StepCard n="01" title={t('landingHowStep1Title')} detail={t('landingHowStep1Detail')} />
                <StepCard n="02" title={t('landingHowStep2Title')} detail={t('landingHowStep2Detail')} />
                <StepCard n="03" title={t('landingHowStep3Title')} detail={t('landingHowStep3Detail')} />
              </div>
            </div>
          </section>

          <section id="contact" className="pt-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="sr-card-soft p-6">
                <div className="text-2xl font-semibold">{t('landingEnquiryTitle')}</div>
                <div className="sr-subtitle">{t('landingEnquirySubtitle')}</div>

                {!envOk ? (
                  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                    Missing <strong>VITE_SUPABASE_URL</strong> / <strong>VITE_SUPABASE_ANON_KEY</strong>.
                  </div>
                ) : null}

                <form className="mt-5 space-y-3" onSubmit={onSubmit}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('landingEnquiryFullName')}</label>
                      <input
                        className="sr-input"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value.slice(0, 100))}
                        maxLength={100}
                        required
                      />
                      <div className="text-right text-xs text-slate-400 mt-0.5">{fullName.length}/100</div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('landingEnquiryMobile')}</label>
                      <input
                        className={`sr-input ${phoneError ? 'border-rose-400 focus:ring-rose-400' : ''}`}
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        inputMode="numeric"
                        autoComplete="tel"
                        pattern="\d{10}"
                        maxLength={10}
                        placeholder={t('landingPhonePlaceholder')}
                        required
                      />
                      {phoneError
                        ? <div className="text-xs text-rose-500 mt-0.5">{phoneError}</div>
                        : <div className="text-right text-xs text-slate-400 mt-0.5">{phone.length}/10 digits</div>
                      }
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('landingEnquiryEmailOptional')}</label>
                    <input
                      className="sr-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('landingEnquiryMessage')}</label>
                    <textarea
                      className="sr-textarea"
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                      rows={4}
                      maxLength={1000}
                      placeholder={t('landingEnquiryMessagePlaceholder')}
                      required
                    />
                    <div className={`text-right text-xs mt-0.5 ${message.length >= 950 ? 'text-rose-400' : 'text-slate-400'}`}>
                      {message.length}/1000
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button className="sr-btn-primary disabled:opacity-60" disabled={!canSubmit || busy} type="submit">
                      {busy ? t('landingEnquirySending') : t('landingEnquirySend')}
                    </button>
                    <div className="text-xs text-slate-600 dark:text-slate-400">{t('landingEnquiryReplyTime')}</div>
                  </div>
                </form>
              </div>

              <div className="sr-card p-6">
                <div className="text-2xl font-semibold">{t('landingWhyTitle')}</div>
                <div className="sr-subtitle">{t('landingWhySubtitle')}</div>

                <div className="mt-5 grid grid-cols-1 gap-3">
                  <ValueRow title={t('landingWhyRow1Title')} detail={t('landingWhyRow1Detail')} />
                  <ValueRow title={t('landingWhyRow2Title')} detail={t('landingWhyRow2Detail')} />
                  <ValueRow title={t('landingWhyRow3Title')} detail={t('landingWhyRow3Detail')} />
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-4 transition-transform hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold">{t('landingWhyLocation')}</div>
                    <IconBadge kind="sky" icon={<IconArrow />} />
                  </div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {centerAddress ?? t('landingWhyLocationValue')}
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(centerAddress ?? t('landingWhyLocationValue'))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21c-4-4.5-6-7.9-6-10.5a6 6 0 1 1 12 0C18 13.1 16 16.5 12 21z"/><circle cx="12" cy="10.5" r="2" fill="currentColor" stroke="none"/></svg>
                    Get Directions
                  </a>
                </div>

                <div className="mt-4 sr-card-soft p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">A place that feels premium</div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">Calm visuals, clean setup, and a focus-first vibe.</div>
                    </div>
                    <div className="shrink-0">
                      <HeroIllustration />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer className="mt-10 border-t border-slate-200/60 py-8 text-center text-xs text-slate-600 dark:border-slate-800/60 dark:text-slate-400">
            <div className="font-semibold text-slate-700 dark:text-slate-300">Phoenix™</div>
            <div>{t('landingFooterRights', { year })}</div>
          </footer>
        </div>
      </main>
    </div>
  )
}

function PhoenixLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M32 6c-4.7 5.3-6.8 10.7-6.8 16.3 0 3.2.6 6.5 1.8 9.8-5-3.1-8.9-7.6-10.6-13.2C11.6 29.1 14.4 43 26 50.5c-2.4-5.6-2.2-10.4.4-14.5 1.1 5.8 3.6 10.2 7.6 13.3 4-3.1 6.5-7.5 7.6-13.3 2.7 4.1 2.8 8.9.4 14.5C49.6 43 52.4 29.1 47.6 18.9c-1.7 5.6-5.6 10.1-10.6 13.2 1.2-3.3 1.8-6.6 1.8-9.8C38.8 16.7 36.7 11.3 32 6Z"
        clipRule="evenodd"
      />
      <path
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        d="M19 54c4 2.7 8.3 4 13 4s9-1.3 13-4"
        opacity="0.9"
      />
    </svg>
  )
}

function HighlightCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 transition-transform hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        <IconBadge kind="emerald" icon={<IconCheck />} />
      </div>
      <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{detail}</div>
    </div>
  )
}

function StepCard({ n, title, detail }: { n: string; title: string; detail: string }) {
  return (
    <div className="sr-card p-5">
      <div className="text-xs text-slate-500 dark:text-slate-400">{n}</div>
      <div className="mt-1 text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{detail}</div>
    </div>
  )
}

function ValueRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 transition-transform hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        <IconBadge kind="sky" icon={<IconArrow />} />
      </div>
      <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{detail}</div>
    </div>
  )
}

function FacilityCard({
  kind,
  icon,
  title,
  detail,
}: {
  kind: IconKind
  icon: React.ReactNode
  title: string
  detail: string
}) {
  const bg =
    kind === 'emerald'
      ? 'from-emerald-500/10 to-transparent dark:from-emerald-400/10'
      : kind === 'amber'
        ? 'from-amber-500/10 to-transparent dark:from-amber-400/10'
        : 'from-sky-500/10 to-transparent dark:from-sky-400/10'

  return (
    <div className={`sr-card p-5 transition-transform hover:-translate-y-0.5 bg-gradient-to-br ${bg}`}>
      <div className="flex items-start gap-3">
        <IconBadge kind={kind} icon={icon} />
        <div>
          <div className="text-base font-semibold">{title}</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{detail}</div>
        </div>
      </div>
    </div>
  )
}

function PlanFeature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
      <span className="text-emerald-700 dark:text-emerald-200">{icon}</span>
      <span>{text}</span>
    </div>
  )
}

function HeroMosaic({ images: dynamicImages }: { images: string[] }) {
  const images = dynamicImages.length > 0
    ? dynamicImages.map((src, i) => ({ src, alt: `Study room photo ${i + 1}` }))
    : []
  const [idx, setIdx] = React.useState(0)

  // Hide if no images uploaded
  if (images.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      {/* Mobile: carousel */}
      <div className="sm:hidden">
        <div className="relative h-52 overflow-hidden rounded-xl">
          <img
            key={idx}
            src={images[idx].src}
            alt={images[idx].alt}
            className="h-full w-full object-cover transition-opacity duration-300"
          />
          <button
            onClick={() => setIdx((i) => (i === 0 ? images.length - 1 : i - 1))}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white"
            aria-label="Previous"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button
            onClick={() => setIdx((i) => (i === images.length - 1 ? 0 : i + 1))}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white"
            aria-label="Next"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Desktop: mosaic grid */}
      <div className="hidden sm:grid grid-cols-12 gap-2">
        <div className="col-span-7 h-28 overflow-hidden rounded-xl">
          <img src={images[0]?.src} alt={images[0]?.alt} className="h-full w-full object-cover" />
        </div>
        <div className="col-span-5 h-28 overflow-hidden rounded-xl">
          <img src={images[1]?.src} alt={images[1]?.alt} className="h-full w-full object-cover" />
        </div>
        <div className="col-span-4 h-24 overflow-hidden rounded-xl">
          <img src={images[3]?.src} alt={images[3]?.alt} className="h-full w-full object-cover" />
        </div>
        <div className="col-span-8 h-24 overflow-hidden rounded-xl">
          <img src={images[2]?.src} alt={images[2]?.alt} className="h-full w-full object-cover" />
        </div>
      </div>
    </div>
  )
}

function PlanIllustration() {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" aria-hidden="true" className="opacity-95">
      <rect x="1" y="1" width="138" height="118" rx="18" className="fill-white/70 dark:fill-slate-950/40" />
      <rect x="1" y="1" width="138" height="118" rx="18" className="stroke-slate-200 dark:stroke-slate-800" />

      <path d="M18 78c10-18 22-26 36-26 22 0 32 20 68 20" className="stroke-sky-500/70 dark:stroke-sky-400/70" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 90c14-12 28-18 44-18 20 0 28 10 60 10" className="stroke-emerald-500/70 dark:stroke-emerald-400/70" strokeWidth="4" strokeLinecap="round" />

      <rect x="20" y="18" width="46" height="10" rx="5" className="fill-amber-500/20 dark:fill-amber-400/15" />
      <rect x="20" y="34" width="88" height="10" rx="5" className="fill-sky-500/15 dark:fill-sky-400/12" />
      <rect x="20" y="50" width="74" height="10" rx="5" className="fill-emerald-500/15 dark:fill-emerald-400/12" />
    </svg>
  )
}

type IconKind = 'sky' | 'emerald' | 'amber'

function IconBadge({ kind, icon }: { kind: IconKind; icon: React.ReactNode }) {
  const cls =
    kind === 'emerald'
      ? 'border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200'
      : kind === 'amber'
        ? 'border-amber-600/30 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200'
        : 'border-sky-600/30 bg-sky-500/10 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200'

  return (
    <div className={`grid h-10 w-10 place-items-center rounded-2xl border ${cls}`}>{icon}</div>
  )
}

// Facility icons and colors are driven by stable IDs (not translated text).

function IconSeat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-90" aria-hidden="true">
      <path d="M8 12h7a4 4 0 0 1 4 4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 20v-6a6 6 0 0 1 6-6h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 6h6a2 2 0 0 1 2 2v4H9V6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function IconQuiet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-90" aria-hidden="true">
      <path d="M11 5a4 4 0 0 1 4 4v5a4 4 0 0 1-8 0V9a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="2" />
      <path d="M5 11v3a6 6 0 0 0 12 0v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 19h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconLamp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-90" aria-hidden="true">
      <path d="M12 2a7 7 0 0 1 4 12v2H8v-2a7 7 0 0 1 4-12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 20h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconSpark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-90" aria-hidden="true">
      <path d="M12 2l1.4 5.6L19 9l-5.6 1.4L12 16l-1.4-5.6L5 9l5.6-1.4L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M5 16l.7 2.8L8.5 20l-2.8.7L5 23l-.7-2.3L1.5 20l2.8-1.2L5 16Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function IconBolt() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-90" aria-hidden="true">
      <path d="M13 2L3 14h8l-1 8 11-14h-8l0-6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-90" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-90" aria-hidden="true">
      <path d="M5 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m13 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function HeroIllustration() {
  return (
    <svg width="92" height="56" viewBox="0 0 92 56" fill="none" aria-hidden="true" className="opacity-90">
      <rect x="1" y="1" width="90" height="54" rx="14" className="fill-white/70 dark:fill-slate-950/40" />
      <rect x="1" y="1" width="90" height="54" rx="14" className="stroke-slate-200 dark:stroke-slate-800" />
      <path d="M18 35c5-9 12-13 20-13 12 0 18 10 36 10" className="stroke-sky-500/70 dark:stroke-sky-400/70" strokeWidth="3" strokeLinecap="round" />
      <path d="M18 41c7-6 14-9 22-9 11 0 16 7 34 7" className="stroke-emerald-500/70 dark:stroke-emerald-400/70" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22" cy="18" r="4" className="fill-amber-500/30 dark:fill-amber-400/25" />
      <circle cx="35" cy="14" r="3" className="fill-sky-500/25 dark:fill-sky-400/20" />
      <circle cx="47" cy="18" r="2" className="fill-emerald-500/25 dark:fill-emerald-400/20" />
    </svg>
  )
}
