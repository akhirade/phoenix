import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ToastProvider'

export function LandingPage() {
  const toast = useToast()

  const envOk = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

  const year = new Date().getFullYear()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const canSubmit = useMemo(() => {
    if (!envOk) return false
    if (!fullName.trim()) return false
    if (!phone.trim()) return false
    if (!message.trim()) return false
    return true
  }, [envOk, fullName, phone, message])

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
      if (error) throw error

      setFullName('')
      setPhone('')
      setEmail('')
      setMessage('')
      toast.success('Thanks! We received your message.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not submit'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="px-4 py-6">
        <div className="mx-auto w-full max-w-5xl flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Phoenix Study Room</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">A focused study space for serious learners.</div>
          </div>

          <div className="flex items-center gap-2">
            <Link className="sr-btn" to="/login">
              Admin Login
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 pb-10">
        <div className="mx-auto w-full max-w-5xl">
          <section className="sr-card p-5">
            <div className="text-2xl font-semibold">Study. Focus. Achieve.</div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Phoenix Study Room helps you stay consistent with a calm environment, dedicated seating, and a simple admission process.
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <a className="sr-btn-primary" href="#contact">
                Enquire Now
              </a>
              <Link className="sr-btn" to="/login">
                Existing Staff
              </Link>
            </div>
          </section>

          <section id="contact" className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="sr-card-soft p-5">
              <div className="sr-title">Contact / Enquiry</div>
              <div className="sr-subtitle">Send your details and we’ll get back to you.</div>

              {!envOk ? (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                  Missing <strong>VITE_SUPABASE_URL</strong> / <strong>VITE_SUPABASE_ANON_KEY</strong>.
                </div>
              ) : null}

              <form className="mt-4 space-y-3" onSubmit={onSubmit}>
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Full Name</label>
                  <input className="sr-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Mobile Number</label>
                  <input
                    className="sr-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="10-digit"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Email (optional)</label>
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
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Message</label>
                  <textarea
                    className="sr-textarea"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Ask about seats, timing, monthly fee, rules…"
                    required
                  />
                </div>

                <button className="sr-btn-primary disabled:opacity-60" disabled={!canSubmit || busy} type="submit">
                  {busy ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            </div>

            <div className="sr-card p-5">
              <div className="sr-title">What you get</div>
              <div className="sr-subtitle">A simple, quiet setup designed for consistency.</div>

              <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex gap-2">
                  <span className="text-slate-400">•</span>
                  <span>Dedicated seating & easy monthly tracking</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400">•</span>
                  <span>Comfortable environment for long study sessions</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400">•</span>
                  <span>Admission form and student onboarding</span>
                </li>
              </ul>

              <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                Tip: If you already received an admission link, open it directly (example: <span className="font-mono">/admission/&lt;token&gt;</span>).
              </div>
            </div>
          </section>

          <footer className="mt-8 text-center text-xs text-slate-600 dark:text-slate-400">
            <div>Phoenix™</div>
            <div>© {year} Phoenix Study Room. All rights reserved.</div>
          </footer>
        </div>
      </main>
    </div>
  )
}
