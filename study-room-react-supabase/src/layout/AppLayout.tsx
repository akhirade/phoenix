import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../lib/DataProvider'
import { supabase } from '../lib/supabase'
import { useTheme } from '../theme/ThemeProvider'
import { useI18n } from '../i18n/I18nProvider'

function AdmissionIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
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
      <path d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v4a2 2 0 0 0 2 2h4" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  )
}

function EnquiryIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
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
      <path d="M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6l-4 3V8a2 2 0 0 1 2-2Z" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
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

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'block rounded-lg px-3 py-2 text-sm border',
    isActive
      ? 'bg-sky-500/10 border-sky-500/35 text-slate-900 dark:border-sky-400/40 dark:text-slate-100'
      : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:border-slate-700',
  ].join(' ')

export function AppLayout() {
  const { signOut, session } = useAuth()
  const { settings, students, tenantError } = useData()
  const { theme, toggleTheme } = useTheme()
  const { locale, toggleLocale, t } = useI18n()
  const navigate = useNavigate()

  const storageKey = useMemo(() => {
    const email = session?.user?.email || 'anon'
    return `phoenix-admissions-seen-at:${email}`
  }, [session?.user?.email])

  const enquiriesStorageKey = useMemo(() => {
    const email = session?.user?.email || 'anon'
    return `phoenix-enquiries-seen-at:${email}`
  }, [session?.user?.email])

  const [seenAt, setSeenAt] = useState<number>(() => {
    const raw = localStorage.getItem(storageKey)
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) ? n : 0
  })

  const [unreadEnquiriesCount, setUnreadEnquiriesCount] = useState(0)

  useEffect(() => {
    const raw = localStorage.getItem(storageKey)
    const n = raw ? Number(raw) : 0
    setSeenAt(Number.isFinite(n) ? n : 0)
  }, [storageKey])

  const loadUnreadEnquiriesCount = useCallback(async () => {
    if (!session?.user) return

    const raw = localStorage.getItem(enquiriesStorageKey)
    const n = raw ? Number(raw) : 0
    const currentSeenAt = Number.isFinite(n) ? n : 0

    const sinceIso = new Date(currentSeenAt || 0).toISOString()
    const { count, error } = await supabase
      .from('contact_messages')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', sinceIso)

    if (error) {
      setUnreadEnquiriesCount(0)
      return
    }

    setUnreadEnquiriesCount(count ?? 0)
  }, [enquiriesStorageKey, session?.user])

  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      if (cancelled) return
      await loadUnreadEnquiriesCount()
    }

    void tick()
    const id = window.setInterval(() => void tick(), 60000)

    const onSeen = () => void tick()
    window.addEventListener('phoenix-enquiries-seen', onSeen)

    return () => {
      cancelled = true
      window.clearInterval(id)
      window.removeEventListener('phoenix-enquiries-seen', onSeen)
    }
  }, [loadUnreadEnquiriesCount])

  const newAdmissionsCount = useMemo(() => {
    if (!students?.length) return 0
    return students.filter((s) => {
      if (!s.admission_submitted_at) return false
      const ts = Date.parse(String(s.admission_submitted_at))
      return Number.isFinite(ts) && ts > seenAt
    }).length
  }, [students, seenAt])

  const markAdmissionsSeen = () => {
    const now = Date.now()
    localStorage.setItem(storageKey, String(now))
    setSeenAt(now)
  }

  const markEnquiriesSeen = () => {
    const now = Date.now()
    localStorage.setItem(enquiriesStorageKey, String(now))
    setUnreadEnquiriesCount(0)
    window.dispatchEvent(new Event('phoenix-enquiries-seen'))
  }

  const year = new Date().getFullYear()
  const trademarkText = 'Phoenix™'
  const copyrightText = `© ${year} Ashish Khirade. All rights reserved.`

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 hover:opacity-90" aria-label={t('appName')}>
              <PhoenixLogo className="h-8 w-8 text-rose-600 dark:text-rose-400" />
              <div className="font-semibold">{(settings.centerName || t('appName')).trim()}</div>
            </Link>
            {session?.user?.email ? (
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {t('headerLoggedInAs', { email: session.user.email })}
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-2 shrink-0 flex-nowrap">
            <button
              className="sr-btn"
              type="button"
              onClick={() => {
                markAdmissionsSeen()
                navigate('/dashboard')
              }}
              aria-label={t('newAdmissions')}
              title={t('newAdmissions')}
            >
              <span className="relative inline-flex items-center">
                <AdmissionIcon className="h-5 w-5" />
                <span className="sr-only">{t('newAdmissions')}</span>
                {newAdmissionsCount > 0 ? (
                  <span className="absolute -right-2 -top-2 inline-flex min-w-[1.25rem] justify-center rounded-full border border-emerald-600/30 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100">
                    {newAdmissionsCount}
                  </span>
                ) : null}
              </span>
            </button>

            <button
              className="sr-btn"
              type="button"
              onClick={() => {
                markEnquiriesSeen()
                navigate('/enquiries')
              }}
              aria-label={t('navEnquiries')}
              title={t('navEnquiries')}
            >
              <span className="relative inline-flex items-center">
                <EnquiryIcon className="h-5 w-5" />
                <span className="sr-only">{t('navEnquiries')}</span>
                {unreadEnquiriesCount > 0 ? (
                  <span className="absolute -right-2 -top-2 inline-flex min-w-[1.25rem] justify-center rounded-full border border-rose-600/30 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-100">
                    {unreadEnquiriesCount}
                  </span>
                ) : null}
              </span>
            </button>
            <button className="sr-btn" type="button" onClick={toggleLocale} aria-label="Toggle language">
              {locale === 'en' ? t('langEnglish') : t('langMarathi')}
            </button>
            <button className="sr-btn" type="button" onClick={toggleTheme}>
              {theme === 'dark' ? t('themeLight') : t('themeDark')}
            </button>
            <button
              className="sr-btn"
              type="button"
              onClick={() => signOut()}
            >
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-4 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        <aside className="rounded-xl border border-slate-200 bg-white/70 p-2 h-fit dark:border-slate-800 dark:bg-slate-900/30">
          <nav className="space-y-2">
            <NavLink to="/dashboard" className={linkClass}>{t('navDashboard')}</NavLink>
            <NavLink to="/students" className={linkClass}>{t('navStudents')}</NavLink>
            <NavLink to="/seats" className={linkClass}>{t('navSeats')}</NavLink>
            <NavLink to="/payments" className={linkClass}>{t('navPayments')}</NavLink>
            <NavLink to="/reports" className={linkClass}>{t('navReports')}</NavLink>
            <NavLink to="/enquiries" className={linkClass}>{t('navEnquiries')}</NavLink>
            <NavLink to="/settings" className={linkClass}>{t('navSettings')}</NavLink>
          </nav>
        </aside>

        <main className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/30">
          {tenantError ? (
            <div className="sr-card p-4">
              <div className="text-base font-semibold">Setup required</div>
              <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">{tenantError}</div>
              {session?.user?.email ? (
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  Logged in as <span className="font-medium">{session.user.email}</span>
                </div>
              ) : null}
              <div className="mt-4 flex items-center gap-2">
                <button className="sr-btn" type="button" onClick={() => signOut()}>
                  {t('logout')}
                </button>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      <footer className="mx-auto max-w-6xl px-4 pb-6 text-xs text-slate-600 dark:text-slate-400">
        <div>{trademarkText}</div>
        <div>{copyrightText}</div>
      </footer>
    </div>
  )
}
