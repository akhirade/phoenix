import React, { createContext, useContext, useMemo, useRef, useState } from 'react'

type ToastKind = 'success' | 'error'

type ToastItem = {
  id: string
  kind: ToastKind
  message: string
}

type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function uid() {
  return `${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, number>())

  function push(kind: ToastKind, message: string) {
    const id = uid()
    const item: ToastItem = { id, kind, message }
    setItems((prev) => [item, ...prev].slice(0, 4))

    const t = window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id))
      timers.current.delete(id)
    }, 2600)

    timers.current.set(id, t)
  }

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
    }),
    [],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 bottom-4 z-[60] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={
              'rounded-xl border px-3 py-2 text-sm shadow-xl ' +
              (t.kind === 'success'
                ? 'border-emerald-600/30 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-100'
                : 'border-rose-600/30 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-100')
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
