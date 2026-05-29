import { type ReactNode, useEffect } from 'react'
import { useI18n } from '../i18n/I18nProvider'

export function Modal({
  open,
  title,
  subtitle,
  children,
  onClose,
}: {
  open: boolean
  title: string
  subtitle?: string
  children: ReactNode
  onClose: () => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-3xl max-h-[calc(100vh-2rem)] flex flex-col rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div>
            <div className="text-base font-semibold">{title}</div>
            {subtitle ? <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{subtitle}</div> : null}
          </div>
          <button
            className="sr-btn"
            onClick={onClose}
          >
            {t('close')}
          </button>
        </div>
        <div className="min-h-0 overflow-auto p-4">{children}</div>
      </div>
    </div>
  )
}
