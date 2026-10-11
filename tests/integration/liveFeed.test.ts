import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeedEvent } from '@/entities'
import { createLiveFeed } from '@/features/market-feed/lib/liveFeed'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static last(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1]
  }
  url: string
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  readyState = 0

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }
  close() {
    this.readyState = 3
  }
  simulateOpen() {
    this.onopen?.()
  }
  simulateMessage(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify({ stream: 'x', data: obj }) })
  }
  simulateClose() {
    this.onclose?.()
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-11T12:00:00Z'))
  MockWebSocket.instances = []
  vi.stubGlobal('WebSocket', MockWebSocket)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function makeFeed() {
  const events: FeedEvent[] = []
  const feed = createLiveFeed({
    symbol: 'BTCUSDT',
    timeframe: '1m',
    wsBase: 'wss://mock',
    restBase: 'http://127.0.0.1:9',
    maxAttempts: 3,
    fallbackAfterMs: 30_000,
  })
  feed.on((e) => events.push(e))
  return { feed, events }
}

describe('live feed', () => {
  it('combined stream URL: depth20@100ms + kline + ticker', () => {
    makeFeed().feed.start()
    const url = MockWebSocket.last().url
    expect(url).toContain('btcusdt@depth20@100ms')
    expect(url).toContain('btcusdt@kline_1m')
    expect(url).toContain('btcusdt@ticker')
  })

  it('depth20 → normalize edilmiş book', async () => {
    const { feed, events } = makeFeed()
    feed.start()
    MockWebSocket.last().simulateOpen()
    await vi.advanceTimersByTimeAsync(50)
    MockWebSocket.last().simulateMessage({
      e: 'depth20',
      u: 100,
      bids: [
        ['67000', '1'],
        ['66999', '2'],
      ],
      asks: [['67001', '3']],
    })
    const bookEv = events.find((e) => e.type === 'book')
    expect(bookEv).toBeDefined()
    if (bookEv?.type === 'book') {
      expect(bookEv.book.bids[0].price).toBe(67000)
      expect(bookEv.book.bids[1].price).toBe(66999)
      expect(bookEv.book.bids[1].total).toBe(3)
      expect(bookEv.book.lastUpdateId).toBe(100)
    }
  })

  it('kline x:true → kapalı mum; ticker → 24s', async () => {
    const { feed, events } = makeFeed()
    feed.start()
    MockWebSocket.last().simulateOpen()
    await vi.advanceTimersByTimeAsync(50)
    const ws = MockWebSocket.last()
    ws.simulateMessage({
      e: 'kline',
      k: { t: 1_700_000_000_000, o: '100', h: '101', l: '99', c: '100.5', v: '10', x: false },
    })
    ws.simulateMessage({
      e: 'kline',
      k: { t: 1_700_000_000_000, o: '100', h: '101', l: '99', c: '100.6', v: '12', x: true },
    })
    ws.simulateMessage({ e: '24hrTicker', c: '100.6', P: '1.5', H: '102', L: '98', v: '999' })
    const candles = events.filter((e) => e.type === 'candle')
    expect(candles).toHaveLength(2)
    expect((candles[0] as { candle: { closed: boolean } }).candle.closed).toBe(false)
    expect((candles[1] as { candle: { closed: boolean } }).candle.closed).toBe(true)
    expect((candles[1] as { candle: { close: number } }).candle.close).toBe(100.6)
    const ticker = events.find((e) => e.type === 'ticker')
    expect(ticker).toMatchObject({ type: 'ticker', ticker: { last: 100.6, changePct: 1.5 } })
  })

  it('geçersiz mesaj → log + atla (stream düşmez)', () => {
    const { feed, events } = makeFeed()
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    feed.start()
    MockWebSocket.last().simulateOpen()
    const ws = MockWebSocket.last()
    ws.onmessage?.({ data: 'bu bir json değil' })
    ws.simulateMessage({ e: 'depth20', bids: [], asks: [['1', '2']] }) // geçersiz şema
    ws.simulateMessage({ e: 'depth20', u: 1, bids: [['10', '1']], asks: [['11', '1']] })
    expect(debug).toHaveBeenCalled()
    expect(events.filter((e) => e.type === 'book')).toHaveLength(1)
    debug.mockRestore()
  })

  it('backoff: 1s → 2s, 3. kopuşta offline (demo fallback sinyali)', async () => {
    const { feed, events } = makeFeed()
    feed.start()
    const ws = MockWebSocket.last()
    ws.simulateOpen()
    await vi.advanceTimersByTimeAsync(50)

    ws.simulateClose() // 1. kopuş
    expect(events[events.length - 1]).toMatchObject({ type: 'status', status: 'reconnecting' })
    await vi.advanceTimersByTimeAsync(999)
    expect(MockWebSocket.instances).toHaveLength(1) // henüz bağlanmadı
    await vi.advanceTimersByTimeAsync(2) // 1s dolunca reconnect
    expect(MockWebSocket.instances).toHaveLength(2)

    MockWebSocket.last().simulateClose() // 2. kopuş
    await vi.advanceTimersByTimeAsync(1999)
    expect(MockWebSocket.instances).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(3) // 2s
    expect(MockWebSocket.instances).toHaveLength(3)

    MockWebSocket.last().simulateClose() // 3. kopuş → offline
    expect(events[events.length - 1]).toMatchObject({ type: 'status', status: 'offline' })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(MockWebSocket.instances).toHaveLength(3) // yeni deneme yok
  })

  it('setPaused(true) → socket kapanır, false → yeniden bağlanır', async () => {
    const { feed, events } = makeFeed()
    feed.start()
    MockWebSocket.last().simulateOpen()
    await vi.advanceTimersByTimeAsync(50)
    feed.setPaused(true)
    expect(MockWebSocket.instances[0].readyState).toBe(3)
    const before = MockWebSocket.instances.length
    feed.setPaused(false)
    expect(MockWebSocket.instances.length).toBe(before + 1)
    expect(events.filter((e) => e.type === 'status').length).toBeGreaterThan(1)
  })
})
