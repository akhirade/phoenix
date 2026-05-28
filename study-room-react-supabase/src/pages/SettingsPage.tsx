import { useState } from 'react'
import { useData } from '../lib/DataProvider'
import { useToast } from '../components/ToastProvider'
import { useI18n } from '../i18n/I18nProvider'

export function SettingsPage() {
  const { settings, saveSettings } = useData()
  const toast = useToast()
  const { t } = useI18n()
  const [fee, setFee] = useState(String(settings.defaultMonthlyFee))
  const [due, setDue] = useState(String(settings.defaultDueDay))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function onSave() {
    setMsg(null)
    setBusy(true)
    try {
      const f = Number(fee || 0)
      const d = Number(due || 5)
      if (d < 1 || d > 28) throw new Error(t('errDueDayRange'))
      await saveSettings({ defaultMonthlyFee: f, defaultDueDay: d })
      toast.success(t('settingsSaved'))
      setMsg(t('saved'))
    } catch (e: any) {
      setMsg(e?.message || t('saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div>
        <div className="sr-title">{t('settingsTitle')}</div>
        <div className="sr-subtitle">{t('settingsSubtitle')}</div>
      </div>

      {msg ? (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-200">
          {msg}
        </div>
      ) : null}

      <div className="mt-4 sr-card p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('defaultMonthlyFee')}</label>
            <input
              className="sr-input"
              type="number"
              min={0}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('defaultDueDay')}</label>
            <input
              className="sr-input"
              type="number"
              min={1}
              max={28}
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            className="sr-btn-primary disabled:opacity-60"
            onClick={onSave}
            disabled={busy}
          >
            {busy ? t('saving') : t('save')}
          </button>
        </div>
      </div>

      <div className="mt-4 text-xs text-slate-500">
        {t('securityTip')}
      </div>
    </div>
  )
}
