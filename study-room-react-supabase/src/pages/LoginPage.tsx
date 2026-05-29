import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n/I18nProvider'

export function LoginPage() {
  const { session } = useAuth()
  const { locale, toggleLocale, t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/dashboard" replace />

  const envOk = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!envOk) {
      setError('Missing Supabase env vars. Copy .env.example to .env and fill values.')
      return
    }

    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (err: any) {
      setError(err?.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 grid place-items-center px-4">
      <div className="w-full max-w-md sr-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{t('loginTitle')}</div>
          </div>
          <button className="sr-btn" type="button" onClick={toggleLocale} aria-label="Toggle language">
            {locale === 'en' ? t('langEnglish') : t('langMarathi')}
          </button>
        </div>

        {!envOk ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
            Missing <strong>VITE_SUPABASE_URL</strong> / <strong>VITE_SUPABASE_ANON_KEY</strong>.
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-900 dark:text-rose-100">
            {error}
          </div>
        ) : null}

        <form className="mt-4 space-y-3" onSubmit={onLogin}>
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('email')}</label>
            <input
              className="sr-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="username"
              placeholder="name@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('password')}</label>
            <input
              className="sr-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <button
            className="w-full sr-btn-primary disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {busy ? t('signingIn') : t('login')}
          </button>
        </form>

        <div className="text-xs text-slate-500 mt-4">
          {t('tipInviteOnly')}
        </div>
      </div>
    </div>
  )
}
