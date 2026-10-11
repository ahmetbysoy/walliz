import type { BookSnapshot, Wall } from '@/entities'
import { median } from './math'

export interface WallDetectionOptions {
  /** Coin bazlı adaptif çarpan (BTC 2.2 … DOGE 1.4) */
  multiplier: number
  /** Birleşen seviye sayısı (komşu duvarlar tek duvarda birleştirilir) */
  window?: number
  maxWalls?: number
}

function sideWalls(
  levels: { price: number; qty: number }[],
  side: 'bid' | 'ask',
  multiplier: number,
  window: number,
  maxWalls: number,
): Wall[] {
  const n = levels.length
  if (n < window + 2 || multiplier <= 0) return []
  const medianQty = median(levels.map((l) => l.qty))
  if (!Number.isFinite(medianQty) || medianQty <= 0) return []
  const expected = medianQty * window
  const threshold = expected * multiplier
  const used = new Array<boolean>(n).fill(false)
  const found: Wall[] = []
  for (let i = 0; i + window <= n; i++) {
    if (used[i]) continue
    let sum = 0
    for (let j = i; j < i + window; j++) sum += levels[j].qty
    if (sum >= threshold) {
      for (let j = i; j < i + window; j++) used[j] = true
      // bid: pencerenin en düşük fiyatı (destek), ask: en düşük fiyat (direnç)
      const price = side === 'bid' ? levels[i + window - 1].price : levels[i].price
      found.push({
        side,
        price,
        qty: sum,
        levels: window,
        strength: sum / expected,
        ageTicks: 0,
        stable: false,
      })
    }
  }
  found.sort((a, b) => b.strength - a.strength)
  return found.slice(0, maxWalls)
}

/** Saf duvar tespiti: bilinen orderbook → beklenen duvarlar. */
export function detectWalls(book: BookSnapshot, options: WallDetectionOptions): Wall[] {
  const { multiplier, window = 3, maxWalls = 3 } = options
  const bids = sideWalls(book.bids, 'bid', multiplier, window, maxWalls)
  const asks = sideWalls(book.asks, 'ask', multiplier, window, maxWalls)
  return [...bids, ...asks].sort((a, b) => b.strength - a.strength).slice(0, maxWalls)
}

/**
 * Duvar ömrü takibi: aynı fiyattaki duvarın kaç tick'tır sürdüğünü sayar.
 * Worker içinde yaşam alanı bulur (main thread'de inline fallback ile de çalışır).
 */
export class WallTracker {
  readonly stableAfter: number
  private readonly entries = new Map<string, Wall>()

  constructor(stableAfterTicks = 5) {
    this.stableAfter = stableAfterTicks
  }

  tick(walls: Wall[]): Wall[] {
    const seen = new Set<string>()
    const next: Wall[] = walls.map((w) => {
      const key = `${w.side}:${w.price}`
      seen.add(key)
      const prev = this.entries.get(key)
      const ageTicks = prev ? prev.ageTicks + 1 : 1
      const updated: Wall = { ...w, ageTicks, stable: ageTicks >= this.stableAfter }
      this.entries.set(key, updated)
      return updated
    })
    for (const key of [...this.entries.keys()]) {
      if (!seen.has(key)) this.entries.delete(key)
    }
    return next
  }

  reset(): void {
    this.entries.clear()
  }
}
