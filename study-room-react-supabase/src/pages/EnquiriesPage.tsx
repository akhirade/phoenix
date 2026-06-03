import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ToastProvider'
import { useI18n } from '../i18n/I18nProvider'
import { formatLocalDateTime } from '../lib/utils'
import { useAuth } from '../auth/AuthProvider'

type ContactMessage = {
  id: string
  created_at: string
  full_name: string
  phone: string
  email: string | null
  message: string
  source: string
}

export function EnquiriesPage() {
  const toast = useToast()
  const { t, locale } = useI18n()
  const { session } = useAuth()

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ContactMessage[]>([])

  const dateLocale = useMemo(() => (locale === 'mr' ? 'mr-IN' : 'en-IN'), [locale])

  const enquiriesStorageKey = useMemo(() => {
    const email = session?.user?.email || 'anon'
    return `phoenix-enquiries-seen-at:${email}`
  }, [session?.user?.email])

  const markSeenFromRows = useCallback(
    (nextRows: ContactMessage[]) => {
      const newest = nextRows[0]?.created_at ? Date.parse(String(nextRows[0].created_at)) : NaN
      const ts = Number.isFinite(newest) ? newest : Date.now()
      localStorage.setItem(enquiriesStorageKey, String(ts))
      window.dispatchEvent(new Event('phoenix-enquiries-seen'))
    },
    [enquiriesStorageKey],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('id, created_at, full_name, phone, email, message, source')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      const nextRows = (data ?? []) as ContactMessage[]
      setRows(nextRows)
      if (nextRows.length > 0) markSeenFromRows(nextRows)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('enquiriesLoadFailed')
      toast.error(msg)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast, t])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (cancelled) return
      await load()
    })()

    return () => {
      cancelled = true
    }
  }, [load])

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="sr-title">{t('enquiriesTitle')}</div>
          <div className="sr-subtitle">{t('enquiriesSubtitle')}</div>
        </div>

        <button className="sr-btn" type="button" onClick={load} disabled={loading}>
          {loading ? t('loading') : t('enquiriesRefresh')}
        </button>
      </div>

      <div className="mt-4 sr-table-wrap">
        <table className="sr-table">
          <thead className="sr-thead">
            <tr>
              <th className="sr-th">{t('enquiriesColDate')}</th>
              <th className="sr-th">{t('enquiriesColName')}</th>
              <th className="sr-th">{t('enquiriesColPhone')}</th>
              <th className="sr-th">{t('enquiriesColEmail')}</th>
              <th className="sr-th">{t('enquiriesColMessage')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="sr-td whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                  {r.created_at ? formatLocalDateTime(r.created_at, dateLocale) : ''}
                </td>
                <td className="sr-td font-medium">{r.full_name}</td>
                <td className="sr-td">{r.phone}</td>
                <td className="sr-td text-slate-700 dark:text-slate-300">{r.email || '—'}</td>
                <td className="sr-td">
                  <div className="whitespace-pre-wrap break-words">{r.message}</div>
                </td>
              </tr>
            ))}

            {!loading && rows.length === 0 ? (
              <tr>
                <td className="sr-td text-sm text-slate-600 dark:text-slate-400" colSpan={5}>
                  {t('enquiriesEmpty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {loading ? <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">{t('loading')}</div> : null}
    </div>
  )
}
