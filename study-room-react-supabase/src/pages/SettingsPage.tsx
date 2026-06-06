import { useMemo, useRef, useState } from 'react'
import { useData } from '../lib/DataProvider'
import { useToast } from '../components/ToastProvider'
import { useI18n } from '../i18n/I18nProvider'
import { supabase } from '../lib/supabase'
import type { AppSettings } from '../lib/types'

export function SettingsPage() {
  const { settings, saveSettings, students } = useData()

  const maxAssignedSeat = useMemo(() => {
    let max = 0
    for (const s of students) {
      if (s.status !== 'Active') continue
      const n = Number(s.seat_number || 0)
      if (Number.isFinite(n) && n > max) max = n
    }
    return max
  }, [students])

  const key = useMemo(
    () =>
      [
        settings.defaultMonthlyFee,
        settings.defaultDueDay,
        settings.centerName ?? '',
        settings.centerAddress ?? '',
        settings.centerPhone ?? '',
        settings.admissionTerms ?? '',
      ].join('|'),
    [
      settings.defaultMonthlyFee,
      settings.defaultDueDay,
      settings.centerName,
      settings.centerAddress,
      settings.centerPhone,
      settings.admissionTerms,
    ],
  )

  return (
    <SettingsEditor
      key={key}
      settings={settings}
      saveSettings={saveSettings}
      maxAssignedSeat={maxAssignedSeat}
    />
  )
}

function SettingsEditor({
  settings,
  saveSettings,
  maxAssignedSeat,
}: {
  settings: AppSettings
  saveSettings: (next: AppSettings) => Promise<void>
  maxAssignedSeat: number
}) {
  const toast = useToast()
  const { t } = useI18n()

  const [fee, setFee] = useState(String(settings.defaultMonthlyFee))
  const [due, setDue] = useState(String(settings.defaultDueDay))
  const [totalSeats, setTotalSeats] = useState(String(settings.totalSeats ?? 45))
  const [centerName, setCenterName] = useState(settings.centerName ?? '')
  const [centerAddress, setCenterAddress] = useState(settings.centerAddress ?? '')
  const [centerPhone, setCenterPhone] = useState(settings.centerPhone ?? '')
  const [admissionTerms, setAdmissionTerms] = useState(settings.admissionTerms ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [galleryImages, setGalleryImages] = useState<string[]>(settings.galleryImages ?? [])
  const [uploadBusy, setUploadBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploadBusy(true)
    try {
      const uploaded: string[] = []
      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const path = `gallery/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from('study-room').upload(path, file, { upsert: false })
        if (error) throw error
        const { data: urlData } = supabase.storage.from('study-room').getPublicUrl(path)
        uploaded.push(urlData.publicUrl)
      }
      const next = [...galleryImages, ...uploaded]
      setGalleryImages(next)
      await saveSettings({ ...settings, centerName: centerName.trim(), centerAddress: centerAddress.trim(), centerPhone: centerPhone.trim(), admissionTerms: admissionTerms.trim(), galleryImages: next })
      toast.success(`${uploaded.length} image${uploaded.length > 1 ? 's' : ''} uploaded`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function removeImage(url: string) {
    const next = galleryImages.filter((u) => u !== url)
    setGalleryImages(next)
    await saveSettings({ ...settings, centerName: centerName.trim(), centerAddress: centerAddress.trim(), centerPhone: centerPhone.trim(), admissionTerms: admissionTerms.trim(), galleryImages: next })
    toast.success('Image removed')
  }

  async function onSave() {
    setMsg(null)
    setBusy(true)
    try {
      const f = Number(fee || 0)
      const d = Number(due || 5)
      const seats = Number(totalSeats || 45)
      if (d < 1 || d > 28) throw new Error(t('errDueDayRange'))
      if (!Number.isFinite(seats) || seats < 1 || seats > 500) throw new Error(t('errTotalSeatsRange'))
      if (maxAssignedSeat > 0 && seats < maxAssignedSeat) {
        throw new Error(t('errTotalSeatsBelowAssigned', { n: maxAssignedSeat }))
      }
      await saveSettings({
        defaultMonthlyFee: f,
        defaultDueDay: d,
        totalSeats: Math.floor(seats),
        centerName: centerName.trim(),
        centerAddress: centerAddress.trim(),
        centerPhone: centerPhone.trim(),
        admissionTerms: admissionTerms.trim(),
      })
      toast.success(t('settingsSaved'))
      setMsg(t('saved'))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('saveFailed')
      setMsg(msg)
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
        <div className="mt-4 sr-card-soft p-3 text-sm text-slate-700 dark:text-slate-200">
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
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('totalSeats')}</label>
            <input
              className="sr-input"
              type="number"
              min={1}
              max={500}
              value={totalSeats}
              onChange={(e) => setTotalSeats(e.target.value)}
            />
            {maxAssignedSeat > 0 ? (
              <div className="mt-1 text-[11px] text-slate-500">
                {t('maxSeatInUse', { n: maxAssignedSeat })}
              </div>
            ) : null}
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

      <div className="mt-4 sr-card p-3">
        <div className="font-medium text-sm">{t('admissionTemplate')}</div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('centerName')}</label>
            <input className="sr-input" value={centerName} onChange={(e) => setCenterName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('centerPhone')}</label>
            <input className="sr-input" value={centerPhone} onChange={(e) => setCenterPhone(e.target.value)} />
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs text-slate-400 mb-1">{t('centerAddress')}</label>
          <textarea
            className="sr-textarea"
            rows={3}
            value={centerAddress}
            onChange={(e) => setCenterAddress(e.target.value)}
          />
        </div>

        <div className="mt-3">
          <label className="block text-xs text-slate-400 mb-1">{t('termsAndConditions')}</label>
          <textarea
            className="sr-textarea"
            rows={10}
            value={admissionTerms}
            onChange={(e) => setAdmissionTerms(e.target.value)}
          />
        </div>

        <div className="mt-3 flex items-center justify-end">
          <button className="sr-btn-primary disabled:opacity-60" onClick={onSave} disabled={busy}>
            {busy ? t('saving') : t('save')}
          </button>
        </div>
      </div>

      <div className="mt-4 text-xs text-slate-500">
        {t('tipInviteOnly')}
      </div>

      <div className="mt-4 sr-card p-3">
        <div className="font-medium text-sm">Study Room Gallery</div>
        <div className="mt-1 text-xs text-slate-500">Upload photos of your study room. These appear on the public landing page.</div>

        {galleryImages.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {galleryImages.map((url, i) => (
              <div key={url} className="relative group">
                <img src={url} alt={`Gallery ${i + 1}`} className="h-24 w-full rounded-xl object-cover" />
                <button
                  onClick={() => removeImage(url)}
                  className="absolute top-1 right-1 hidden group-hover:flex items-center justify-center h-6 w-6 rounded-full bg-black/60 text-white text-xs"
                  title="Remove"
                  aria-label="Remove image"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-xs text-slate-400">No images uploaded yet.</div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />
          <button
            className="sr-btn disabled:opacity-60"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadBusy}
          >
            {uploadBusy ? 'Uploading…' : 'Upload Images'}
          </button>
          <span className="text-xs text-slate-400">JPG, PNG, WebP · Max 4 images</span>
        </div>
      </div>
    </div>
  )
}
