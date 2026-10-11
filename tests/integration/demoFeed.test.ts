import { describe, expect, it } from 'vitest'
import type { FeedEvent } from '@/entities'
import { createDemoFeed } from '@/features/market-feed/lib/demoFeed'

function collect(ticks: number, opts: Record<string, unknown> = {}) {
  let t = 1_700_000_000_000
  const events: FeedEvent[] = []
  const feed = createDemoFeed({
    symbol: 'BTCUSDT',
    timeframe: '1m',
    mode: 'demo',
    seed: 7,
    now: () => t,
    tickMs: 500,
    candleMs: 4000,
    timed: false,
    ...opts,
  })
  feed.on((e) => events.push(e))
  feed.start()
  for (let i = 0; i < ticks; i++) {
    t += 500
    feed.tick()
  }
  feed.stop()
  return events
}

describe('demo feed', () => {
  it('start → status demo + 180 mum geçmiş', () => {
    const events = collect(0)
    expect(events[0]).toMatchObject({ type: 'status', status: 'demo' })
    const hist = events[1]
    expect(hist.type).toBe('history')
    if (hist.type === 'history') {
      expect(hist.candles).toHaveLength(180)
      expect(hist.candles.every((c) => c.closed)).toBe(true)
    }
  })

  it('her tick: candle + ticker + book', () => {
    const events = collect(3)
    const tickEvents = events.slice(2)
    expect(tickEvents).toHaveLength(9)
    for (let i = 0; i < 3; i++) {
      expect(tickEvents[i * 3].type).toBe('candle')
      expect(tickEvents[i * 3 + 1].type).toBe('ticker')
      expect(tickEvents[i * 3 + 2].type).toBe('book')
    }
  })

  it('mum penceresi dolunca kapalı mum yayınlanır', () => {
    const events = collect(20) // 20 * 500ms = 10s ≥ 8s pencere? candleMs=4000 → 8+ tick'te kapanır
    const closed = events.filter((e) => e.type === 'candle' && e.candle.closed)
    expect(closed.length).toBeGreaterThanOrEqual(1)
    expect(closed.length).toBeLessThanOrEqual(3)
  })

  it('aynı seed → aynı fiyat serisi (deterministik)', () => {
    const a = collect(12)
    const b = collect(12)
    const pricesA = a
      .filter((e) => e.type === 'ticker')
      .map((e) => (e as { ticker: { last: number } }).ticker.last)
    const pricesB = b
      .filter((e) => e.type === 'ticker')
      .map((e) => (e as { ticker: { last: number } }).ticker.last)
    expect(pricesA).toEqual(pricesB)
  })

  it('farklı seed → farklı fiyat serisi', () => {
    const a = collect(8)
    const b = collect(8, { seed: 8 })
    const pa = a
      .filter((e) => e.type === 'ticker')
      .map((e) => (e as { ticker: { last: number } }).ticker.last)
    const pb = b
      .filter((e) => e.type === 'ticker')
      .map((e) => (e as { ticker: { last: number } }).ticker.last)
    expect(pa).not.toEqual(pb)
  })

  it('book her zaman 10+10 seviye, sıralı', () => {
    const events = collect(5)
    const books = events.filter((e) => e.type === 'book')
    expect(books.length).toBe(5)
    for (const b of books) {
      if (b.type !== 'book') continue
      expect(b.book.bids).toHaveLength(10)
      expect(b.book.asks).toHaveLength(10)
      for (let i = 1; i < b.book.bids.length; i++) {
        expect(b.book.bids[i].price).toBeLessThan(b.book.bids[i - 1].price)
      }
      for (let i = 1; i < b.book.asks.length; i++) {
        expect(b.book.asks[i].price).toBeGreaterThan(b.book.asks[i - 1].price)
      }
    }
  })
})
