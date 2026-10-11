import { describe, expect, it } from 'vitest'
import type { BookSnapshot, Candle, Wall } from '@/entities'
import { computeFeatures } from '@/shared/lib/features'

function flatCandles(n: number, close = 100): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    time: i * 60,
    open: close,
    high: close + 0.1,
    low: close - 0.1,
    close,
    volume: 1,
    closed: true,
  }))
}

function balancedBook(price = 100): BookSnapshot {
  const mk = (side: 'bid' | 'ask') =>
    Array.from({ length: 10 }, (_, i) => {
      const price2 = side === 'bid' ? price - (i + 1) * 0.1 : price + (i + 1) * 0.1
      let t = 0
      return { price: price2, qty: 10, total: (t += 10) }
    })
  return { bids: mk('bid'), asks: mk('ask'), ts: 0 }
}

describe('computeFeatures', () => {
  it('yetersiz mumda null', () => {
    expect(
      computeFeatures({ candles: flatCandles(10), book: balancedBook(), walls: [] }),
    ).toBeNull()
  })

  it('düz piyasa: momentum ≈ 0, imbalance = 0, wallPressure = 0', () => {
    const f = computeFeatures({ candles: flatCandles(40), book: balancedBook(), walls: [] })
    expect(f).not.toBeNull()
    expect(Math.abs(f!.momentum)).toBeLessThan(0.05)
    expect(f!.imbalance).toBe(0)
    expect(f!.wallPressure).toBe(0)
  })

  it('yukarı trend: momentum > 0', () => {
    const candles = Array.from({ length: 40 }, (_, i) => {
      const close = 100 + i * 0.5
      return {
        time: i * 60,
        open: close - 0.5,
        high: close + 0.2,
        low: close - 0.2,
        close,
        volume: 1,
        closed: true,
      }
    })
    const f = computeFeatures({ candles, book: balancedBook(100 + 19 * 0.5), walls: [] })
    expect(f!.momentum).toBeGreaterThan(0.5)
    expect(f!.trend).toBeGreaterThan(0)
  })

  it('ask ağırlıklı kitap: imbalance < 0', () => {
    const book = balancedBook()
    for (const a of book.asks) a.total *= 3
    const f = computeFeatures({ candles: flatCandles(40), book, walls: [] })
    expect(f!.imbalance).toBeLessThan(-0.3)
  })

  it('yakın güçlü bid duvarı: wallPressure > 0; ask duvarı: < 0', () => {
    const candles = flatCandles(40)
    const book = balancedBook()
    const bidWall: Wall = {
      side: 'bid',
      price: 99.9,
      qty: 100,
      levels: 3,
      strength: 3,
      ageTicks: 1,
      stable: false,
    }
    const askWall: Wall = {
      side: 'ask',
      price: 100.1,
      qty: 100,
      levels: 3,
      strength: 3,
      ageTicks: 1,
      stable: false,
    }
    const fBid = computeFeatures({ candles, book, walls: [bidWall] })
    const fAsk = computeFeatures({ candles, book, walls: [askWall] })
    expect(fBid!.wallPressure).toBeGreaterThan(0.3)
    expect(fAsk!.wallPressure).toBeLessThan(-0.3)
    const both = computeFeatures({ candles, book, walls: [bidWall, askWall] })
    expect(both!.wallPressure).toBeCloseTo(0, 5)
  })

  it('tüm feature lar [-1, 1] aralığında', () => {
    const candles = Array.from({ length: 60 }, (_, i) => {
      const close = 100 * Math.exp(Math.sin(i / 5) * 0.05)
      return {
        time: i * 60,
        open: close,
        high: close * 1.002,
        low: close * 0.998,
        close,
        volume: 1,
        closed: true,
      }
    })
    const f = computeFeatures({
      candles,
      book: balancedBook(candles[candles.length - 1].close),
      walls: [
        { side: 'bid', price: 90, qty: 500, levels: 3, strength: 10, ageTicks: 1, stable: true },
        { side: 'ask', price: 120, qty: 500, levels: 3, strength: 10, ageTicks: 1, stable: true },
      ],
    })
    for (const k of Object.keys(f!) as (keyof typeof f)[]) {
      expect(f![k]).toBeGreaterThanOrEqual(-1)
      expect(f![k]).toBeLessThanOrEqual(1)
    }
  })
})
