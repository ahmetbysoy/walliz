import type { BookSnapshot, FeatureVector, Wall } from '@/entities'
import { atr, clamp, ema, tanhScale } from './math'

export interface FeatureInput {
  candles: { high: number; low: number; close: number }[]
  book: BookSnapshot
  walls: Wall[]
  atrPeriod?: number
}

/** Yalnızca fiyat türevi feature'lar — geçmiş kline verisinden hesaplanabilenler. */
export interface PriceFeatures {
  momentum: number
  trend: number
  volatility: number
}

export interface PriceFeatureInput {
  candles: { high: number; low: number; close: number }[]
  atrPeriod?: number
}

/**
 * Fiyat türevi feature'lar (mum verisinden).
 *
 * Kitapları (orderbook) geçmişe dönük yayınlamayan borsalarda bu üç feature
 * geçmiş veriyle hesaplanabilir; `imbalance` ve `wallPressure` yalnızca canlı
 * kitap akışı varsa hesaplanır. `computeFeatures` da bu fonksiyonu kullanır,
 * böylece canlı ve geçmiş hesap birbirinden sapmaz.
 */
export function computePriceFeatures(input: PriceFeatureInput): PriceFeatures | null {
  const { candles } = input
  const period = input.atrPeriod ?? 14
  if (candles.length < Math.max(25, period + 2)) return null
  const last = candles[candles.length - 1]
  const price = last.close
  if (!Number.isFinite(price) || price <= 0) return null
  const atrValue = atr(candles, period)
  if (atrValue == null || atrValue <= 0) return null
  const atrPct = atrValue / price

  // momentum: son 6 mumun ATR normlu net hareketi
  const ref = candles[candles.length - 7].close
  const momentum = tanhScale((price - ref) / atrValue, 1.5)

  // trend: EMA5 - EMA20 (ATR normlu)
  const closes = candles.map((c) => c.close)
  const e5 = ema(closes, 5) ?? 0
  const e20 = ema(closes, 20) ?? e5
  const trend = tanhScale((e5 - e20) / atrValue, 1)

  // volatility: ATR/fiyat oranı (0 → -1, %2+ → +1)
  const volatility = clamp01Safe(atrPct / 0.02) * 2 - 1

  return { momentum, trend, volatility }
}

/**
 * Model feature'ları — hepsi [-1, 1] aralığında (tanh / clamp ölçekleme).
 * Kısım oranları ATR bazlı olduğundan coin'e adaptiftir.
 */
export function computeFeatures(input: FeatureInput): FeatureVector | null {
  const { candles, book, walls } = input
  const priceFeatures = computePriceFeatures({ candles, atrPeriod: input.atrPeriod })
  if (!priceFeatures) return null
  const { momentum, trend, volatility } = priceFeatures
  const last = candles[candles.length - 1]
  const price = last.close
  const atrValue = atr(candles, input.atrPeriod ?? 14)
  if (atrValue == null || atrValue <= 0) return null

  // imbalance: üst 10 seviyenin kümülatif derinlik farkı
  const topDepth = (levels: { total: number }[]): number =>
    levels.slice(0, 10).reduce((acc, l) => acc + l.total, 0)
  const bidDepth = topDepth(book.bids)
  const askDepth = topDepth(book.asks)
  const denom = bidDepth + askDepth
  const imbalance = denom > 0 ? (bidDepth - askDepth) / denom : 0

  // wallPressure: en yakın duvarların etki farkı (güç / (1 + ATR'de uzaklık))
  // Yakın/strong bid duvarı destek → pozitif; ask duvarı → negatif.
  const nearest = (side: 'bid' | 'ask'): { dist: number; strength: number } | null => {
    let best: Wall | null = null
    for (const w of walls) {
      if (w.side !== side) continue
      if (side === 'bid' && w.price >= price) continue
      if (side === 'ask' && w.price <= price) continue
      if (!best) best = w
      else if (side === 'bid' ? w.price > best.price : w.price < best.price) best = w
    }
    if (!best) return null
    return { dist: Math.abs(price - best.price) / atrValue, strength: best.strength }
  }
  const db = nearest('bid')
  const da = nearest('ask')
  const bidEffect = db ? db.strength / (1 + db.dist) : 0
  const askEffect = da ? da.strength / (1 + da.dist) : 0
  const wallPressure = clamp(bidEffect - askEffect, -1, 1)

  return { momentum, imbalance, wallPressure, trend, volatility }
}

function clamp01Safe(v: number): number {
  if (!Number.isFinite(v)) return 0
  return clamp(v, 0, 1)
}
