/** Saf matematik yardımcıları (React'tan bağımsız). */

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v))

export const clamp01 = (v: number): number => clamp(v, 0, 1)

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

export interface OHLC {
  high: number
  low: number
  close: number
}

export function trueRange(c: OHLC, prev?: OHLC): number {
  if (!prev) return c.high - c.low
  return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
}

/** Basit ortalama ATR (son `period` mum) */
export function atr(candles: OHLC[], period = 14): number | null {
  if (candles.length < 2) return null
  const n = Math.min(period, candles.length - 1)
  let sum = 0
  for (let i = candles.length - n; i < candles.length; i++) {
    sum += trueRange(candles[i], candles[i - 1])
  }
  return sum / n
}

/** EMA serisinin son değeri */
export function ema(values: number[], period: number): number | null {
  if (values.length === 0 || period <= 0) return null
  const k = 2 / (period + 1)
  let e = values[0]
  for (let i = 1; i < values.length; i++) e = values[i] * k + e * (1 - k)
  return e
}

/** [-1, 1] aralığına oturan sürekli ölçekleme */
export function tanhScale(x: number, k: number): number {
  if (!Number.isFinite(x) || k <= 0) return 0
  return Math.tanh(x / k)
}

/** Deterministik string → uint32 (demo seed, test id'leri) */
export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^= h >>> 16) >>> 0
}
