/**
 * Sayı biçimlendirme — Intl.NumberFormat örnekleri MODÜL SEVİYESİNDE cache'lenir
 * (her render'da üretme anti-pattern'ı).
 */

const cache = new Map<string, Intl.NumberFormat>()

function nf(key: string, init: Intl.NumberFormatOptions): Intl.NumberFormat {
  let f = cache.get(key)
  if (!f) {
    f = new Intl.NumberFormat('en-US', init)
    cache.set(key, f)
  }
  return f
}

export function isUsableNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function autoDecimals(v: number): number {
  const a = Math.abs(v)
  if (a === 0) return 2
  if (a >= 1000) return 2
  if (a >= 1) return 4
  if (a >= 0.1) return 5
  return 6
}

export function formatPrice(value: number, decimals?: number): string {
  if (!isUsableNumber(value)) return '—'
  const d = decimals ?? autoDecimals(value)
  return nf(`p:${d}`, { minimumFractionDigits: d, maximumFractionDigits: d }).format(value)
}

export function formatCompact(value: number): string {
  if (!isUsableNumber(value)) return '—'
  const abs = Math.abs(value)
  const f2 = nf('f2', { maximumFractionDigits: 2 })
  if (abs >= 1e12) return `${f2.format(value / 1e12)}T`
  if (abs >= 1e9) return `${f2.format(value / 1e9)}B`
  if (abs >= 1e6) return `${f2.format(value / 1e6)}M`
  if (abs >= 1e4) return `${f2.format(value / 1e3)}K`
  return f2.format(value)
}

export function formatQty(value: number): string {
  if (!isUsableNumber(value)) return '—'
  const abs = Math.abs(value)
  const d = abs >= 100 ? 0 : abs >= 1 ? 2 : 4
  return nf(`q:${d}`, { minimumFractionDigits: 0, maximumFractionDigits: d }).format(value)
}

export function formatPct(value: number, signed = true): string {
  if (!isUsableNumber(value)) return '—'
  const body = nf('p2', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Math.abs(value),
  )
  const sign = signed && value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${body}%`
}

const dtfCache = new Map<string, Intl.DateTimeFormat>()

function dtf(key: string, init: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let f = dtfCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', init)
    dtfCache.set(key, f)
  }
  return f
}

export function formatTime(ts: number): string {
  if (!isUsableNumber(ts)) return '—'
  return dtf('time', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(ts)
}
