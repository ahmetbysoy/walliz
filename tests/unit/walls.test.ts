import { describe, expect, it } from 'vitest'
import type { BookSnapshot } from '@/entities'
import { WallTracker, detectWalls } from '@/shared/lib/walls'

function flatLevels(
  count: number,
  qty: number,
  side: 'bid' | 'ask',
  start = 100,
): { price: number; qty: number; total: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const price = side === 'bid' ? start - i : start + i
    const total = (i + 1) * qty
    return { price, qty, total }
  })
}

function book(
  bids: { price: number; qty: number }[],
  asks: { price: number; qty: number }[],
): BookSnapshot {
  const withTotal = (l: { price: number; qty: number }[]) => {
    let t = 0
    return l.map((x) => ({ ...x, total: (t += x.qty) }))
  }
  return { bids: withTotal(bids), asks: withTotal(asks), ts: 0 }
}

describe('detectWalls', () => {
  it('düz kitapta duvar yok', () => {
    const b = book(flatLevels(10, 10, 'bid'), flatLevels(10, 10, 'ask', 101))
    expect(detectWalls(b, { multiplier: 2.2, window: 3, maxWalls: 3 })).toEqual([])
  })

  it('tek güçlü seviye → ask duvarı (komşularla birleşir)', () => {
    const bids = flatLevels(10, 10, 'bid')
    const asks = flatLevels(10, 10, 'ask', 101)
    asks[0] = { ...asks[0], qty: 100 }
    const b = book(bids, asks)
    const walls = detectWalls(b, { multiplier: 2.2, window: 3, maxWalls: 3 })
    expect(walls).toHaveLength(1)
    expect(walls[0].side).toBe('ask')
    expect(walls[0].price).toBe(101)
    expect(walls[0].qty).toBe(120)
    expect(walls[0].levels).toBe(3)
    expect(walls[0].strength).toBeCloseTo(4, 5)
  })

  it('güçlü bid seviyesi → destek duvarı (pencerenin en düşük fiyatı)', () => {
    const bids = flatLevels(10, 10, 'bid')
    bids[1] = { ...bids[1], qty: 100 }
    const asks = flatLevels(10, 10, 'ask', 101)
    const b = book(bids, asks)
    const walls = detectWalls(b, { multiplier: 2.2, window: 3, maxWalls: 3 })
    expect(walls).toHaveLength(1)
    expect(walls[0].side).toBe('bid')
    // pencere [0..2] → en düşük fiyat levels[2].price
    expect(walls[0].price).toBe(bids[2].price)
  })

  it('komşu iki güçlü seviye tek duvarda birleşir', () => {
    const bids = flatLevels(10, 10, 'bid')
    bids[0] = { ...bids[0], qty: 80 }
    bids[1] = { ...bids[1], qty: 80 }
    const asks = flatLevels(10, 10, 'ask', 101)
    const b = book(bids, asks)
    const walls = detectWalls(b, { multiplier: 2.2, window: 3, maxWalls: 3 })
    const bidWalls = walls.filter((w) => w.side === 'bid')
    expect(bidWalls).toHaveLength(1)
    expect(bidWalls[0].qty).toBe(80 + 80 + 10)
  })

  it('düşük volatilite çarpanı daha hassastır', () => {
    const bids = flatLevels(10, 10, 'bid')
    bids[3] = { ...bids[3], qty: 40 }
    const asks = flatLevels(10, 10, 'ask', 101)
    const b = book(bids, asks)
    // threshold: 10*3*3.0 = 90 → 60 < 90 yok; 2.0 → 60 ≥ 60 var
    expect(detectWalls(b, { multiplier: 3.0, window: 3 }).length).toBe(0)
    expect(detectWalls(b, { multiplier: 2.0, window: 3 }).length).toBe(1)
  })

  it('maxWalls sınırı', () => {
    const bids = flatLevels(10, 10, 'bid')
    bids[0] = { ...bids[0], qty: 200 }
    bids[5] = { ...bids[5], qty: 200 }
    const asks = flatLevels(10, 10, 'ask', 101)
    asks[0] = { ...asks[0], qty: 200 }
    const b = book(bids, asks)
    expect(detectWalls(b, { multiplier: 2.2, window: 3, maxWalls: 1 })).toHaveLength(1)
  })
})

describe('WallTracker', () => {
  it('aynı duvarın ömrünü sayar, stable eşiği', () => {
    const tracker = new WallTracker(3)
    const walls = [
      {
        side: 'bid' as const,
        price: 99,
        qty: 100,
        levels: 3,
        strength: 4,
        ageTicks: 0,
        stable: false,
      },
    ]
    expect(tracker.tick(walls)[0].ageTicks).toBe(1)
    expect(tracker.tick(walls)[0].ageTicks).toBe(2)
    const third = tracker.tick(walls)[0]
    expect(third.ageTicks).toBe(3)
    expect(third.stable).toBe(true)
  })

  it('kayıbolan duvar sıfırdan başlar', () => {
    const tracker = new WallTracker(3)
    const w = {
      side: 'bid' as const,
      price: 99,
      qty: 100,
      levels: 3,
      strength: 4,
      ageTicks: 0,
      stable: false,
    }
    tracker.tick([w])
    tracker.tick([])
    expect(tracker.tick([w])[0].ageTicks).toBe(1)
  })

  it('reset() temizler', () => {
    const tracker = new WallTracker(3)
    const w = {
      side: 'bid' as const,
      price: 99,
      qty: 100,
      levels: 3,
      strength: 4,
      ageTicks: 0,
      stable: false,
    }
    tracker.tick([w])
    tracker.reset()
    expect(tracker.tick([w])[0].ageTicks).toBe(1)
  })
})
