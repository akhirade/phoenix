import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../theme/ThemeProvider'
import { useI18n } from '../i18n/I18nProvider'

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
  const { theme, toggleTheme } = useTheme()
  const { locale, toggleLocale, t } = useI18n()

  const year = new Date().getFullYear()
  const trademarkText = 'Phoenix™'
  const copyrightText = `© ${year} Ashish Khirade. All rights reserved.`

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <PhoenixLogo className="h-8 w-8 text-rose-600 dark:text-rose-400" />
              <div className="font-semibold">{t('appName')}</div>
            </div>
            {session?.user?.email ? (
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {t('headerLoggedInAs', { email: session.user.email })}
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-2 shrink-0 flex-nowrap">
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
            <NavLink to="/settings" className={linkClass}>{t('navSettings')}</NavLink>
          </nav>
        </aside>

        <main className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/30">
          <Outlet />
        </main>
      </div>

      <footer className="mx-auto max-w-6xl px-4 pb-6 text-xs text-slate-600 dark:text-slate-400">
        <div>{trademarkText}</div>
        <div>{copyrightText}</div>
      </footer>
    </div>
  )
}
