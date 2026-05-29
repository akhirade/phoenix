export function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatINR(n: number): string {
  const val = Number.isFinite(n) ? n : 0
  return val.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  })
}

export function seatNumbers(total = 45): number[] {
  return Array.from({ length: total }, (_, i) => i + 1)
}

export function dueDayFromISODate(iso: string | null | undefined): number | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const day = Number(m[3])
  if (!Number.isFinite(day)) return null
  return Math.min(28, Math.max(1, day))
}

export function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function formatLocalDate(iso: string | null | undefined, locale = 'en-IN'): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: '2-digit' }).format(d)
}

export function formatLocalDateTime(iso: string | null | undefined, locale = 'en-IN'): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
