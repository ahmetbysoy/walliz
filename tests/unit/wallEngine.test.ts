import { describe, expect, it } from 'vitest'
import type { BookSnapshot, Candle } from '@/entities'
import { createWallEngine, type WallEngineResult } from '@/shared/lib/wallEngine'

function flatCandles(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    time: i * 60,
    open: 100,
    high: 100.1,
    low: 99.9,
    close: 100,
    volume: 1,
    closed: true,
  }))
}

function bookWithWall(): BookSnapshot {
  const mk = (side: 'bid' | 'ask', wallAt?: number) =>
    Array.from({ length: 10 }, (_, i) => {
      const price = side === 'bid' ? 100 - i : 100 + i
      const qty = wallAt === i ? 100 : 10
      return { price, qty, total: 0 }
    }).map((l, i, arr) => ({ ...l, total: arr.slice(0, i + 1).reduce((a, x) => a + x.qty, 0) }))
  return { bids: mk('bid'), asks: mk('ask', 0), ts: 0 }
}

describe('createWallEngine (inline fallback)', () => {
  it('duvar + feature döner', () => {
    const engine = createWallEngine({ useWorker: false })
    const results: WallEngineResult[] = []
    const off = engine.onResult((r) => results.push(r))
    engine.push({
      book: bookWithWall(),
      candles: flatCandles(40),
      multiplier: 2.2,
      window: 3,
      maxWalls: 3,
      stableAfterTicks: 5,
    })
    off()
    expect(results).toHaveLength(1)
    expect(results[0].walls.length).toBeGreaterThan(0)
    expect(results[0].walls[0].side).toBe('ask')
    expect(results[0].features).not.toBeNull()
    engine.dispose()
  })

  it('ardışık push → ageTicks artar; reset → sıfırdan', () => {
    const engine = createWallEngine({ useWorker: false })
    const ages: number[] = []
    const off = engine.onResult((r) => {
      if (r.walls[0]) ages.push(r.walls[0].ageTicks)
    })
    const input = {
      book: bookWithWall(),
      candles: flatCandles(40),
      multiplier: 2.2,
      window: 3,
      maxWalls: 3,
      stableAfterTicks: 2,
    }
    engine.push(input)
    engine.push(input)
    engine.push(input)
    engine.reset()
    engine.push(input)
    off()
    engine.dispose()
    expect(ages).toEqual([1, 2, 3, 1])
  })

  it('stable eşiği geçince stable: true', () => {
    const engine = createWallEngine({ useWorker: false })
    let stable = false
    const off = engine.onResult((r) => {
      stable = r.walls[0]?.stable ?? false
    })
    const input = {
      book: bookWithWall(),
      candles: flatCandles(40),
      multiplier: 2.2,
      window: 3,
      maxWalls: 3,
      stableAfterTicks: 2,
    }
    engine.push(input)
    engine.push(input)
    off()
    engine.dispose()
    expect(stable).toBe(true)
  })
})
