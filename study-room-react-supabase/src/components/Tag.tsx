export function Tag({
  kind,
  children,
}: {
  kind: 'good' | 'warn' | 'bad' | 'muted'
  children: React.ReactNode
}) {
  const cls =
    kind === 'good'
      ? 'border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100'
      : kind === 'warn'
        ? 'border-amber-600/30 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
        : kind === 'bad'
          ? 'border-rose-600/30 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100'
          : 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200'

  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>{children}</span>
}
