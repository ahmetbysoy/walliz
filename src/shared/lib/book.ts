import Decimal from 'decimal.js-light'
import type { BookLevel, BookSnapshot, WallSide } from '@/entities'

export type RawRow = readonly [string, string]

/**
 * Ham orderbook satırlarını ([price, qty] string çiftleri) normalize eder:
 * - decimal.js-light ile güvenli parse (float hatası riski için)
 * - geçersiz / ≤0 satırlar atılır
 * - sıralama: bids azalan, asks artan
 * - aynı fiyat birleştirilir (qty toplam)
 * - kümülatif derinlik (total) eklenir
 */
export function normalizeBookRows(rows: readonly RawRow[], side: WallSide): BookLevel[] {
  const byPrice = new Map<string, Decimal>()
  for (const row of rows) {
    if (!row || row.length < 2) continue
    try {
      const price = new Decimal(String(row[0]))
      const qty = new Decimal(String(row[1]))
      if (price.lte(0) || qty.lte(0)) continue
      const key = price.toFixed()
      const prev = byPrice.get(key)
      byPrice.set(key, prev ? prev.plus(qty) : qty)
    } catch {
      /* geçersiz satır — sessizce at */
    }
  }
  const levels = [...byPrice.entries()].map(([key, qty]) => ({
    price: new Decimal(key).toNumber(),
    qty: qty.toNumber(),
  }))
  levels.sort((a, b) => (side === 'bid' ? b.price - a.price : a.price - b.price))
  let running = new Decimal(0)
  return levels.map((l) => {
    running = running.plus(l.qty)
    return { ...l, total: running.toNumber() }
  })
}

export function buildBookSnapshot(
  bidRows: readonly RawRow[],
  askRows: readonly RawRow[],
  ts: number,
  lastUpdateId?: number,
): BookSnapshot {
  return {
    bids: normalizeBookRows(bidRows, 'bid'),
    asks: normalizeBookRows(askRows, 'ask'),
    ts,
    lastUpdateId,
  }
}
