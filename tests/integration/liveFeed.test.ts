import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeedEvent } from '@/entities'
import { createLiveFeed } from '@/features/market-feed/lib/liveFeed'
import { HEARTBEAT_MS, HISTORY_RETRY_MS, RECONNECT_BASE_MS } from '@/shared/config/coins'

/**
 * Canlı feed testleri.
 *
 * Transport (WebSocket) ve HTTP katmanları testte taklit edilir; mesajlar ise
 * Binance'in GERÇEK birleşik stream sözleşmesindeki alan adları/düzenleriyle
 * (`e`, `k.t`, `k.x`, REST kline satır dizilimi) verilir. Amaç, uydurma piyasa
 * verisi kullanmak değil; borsanın gerçek tel formatının doğru ayrıştırıldığını
 * ve veri gelmediğinde hiçbir şey uydurulmadığını doğrulamaktır.
 */

const HOST_A = 'wss://a.test'
const HOST_B = 'wss://b.test'
const REST_A = 'https://rest-a.test'
const REST_B = 'https://rest-b.test'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static last(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1]
  }
  url: string
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: ((ev: { code: number }) => void) | null = null
  readyState = 0

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }
  close() {
    this.readyState = 3
  }
  simulateOpen() {
    this.readyState = 1
    this.onopen?.()
  }
  simulateMessage(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify({ stream: 'x', data: obj }) })
  }
  simulateRaw(text: string) {
    this.onmessage?.({ data: text })
  }
  simulateClose(code = 1006) {
    this.readyState = 3
    this.onclose?.({ code })
  }
}

/** Binance `/api/v3/klines` satırı: [openTime, o, h, l, c, v, closeTime, ...] */
function klineRow(
  openTimeMs: number,
  o: string,
  h: string,
  l: string,
  c: string,
  v: string,
  closeTimeMs: number,
): unknown[] {
  return [openTimeMs, o, h, l, c, v, closeTimeMs, '100', 10, '50', '60', '0']
}

const T0 = 1_700_000_000_000

function makeFeed(overrides: Partial<Parameters<typeof createLiveFeed>[0]> = {}) {
  const events: FeedEvent[] = []
  const feed = createLiveFeed({
    symbol: 'BTCUSDT',
    timeframe: '1m',
    wsBase: HOST_A,
    wsFallbacks: [HOST_B],
    restBase: REST_A,
    restFallbacks: [REST_B],
    offlineAfterAttempts: 3,
    ...overrides,
  })
  feed.on((e) => events.push(e))
  return { feed, events }
}

/** REST yanıtlarını host bazında betikler. `null` → ağ hatası. */
function stubFetch(script: Record<string, unknown[] | number | null>) {
  const calls: string[] = []
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    const host = new URL(url).origin
    const entry = script[host]
    if (entry === null) throw new Error('ağ hatası')
    if (typeof entry === 'number') return { ok: false, status: entry, json: async () => [] }
    if (!entry) return { ok: false, status: 404, json: async () => [] }
    return { ok: true, status: 200, json: async () => entry }
  })
  vi.stubGlobal('fetch', fn)
  return { calls }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(T0))
  MockWebSocket.instances = []
  vi.stubGlobal('WebSocket', MockWebSocket)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('live feed — bağlantı ve gerçek veri akışı', () => {
  it('combined stream URL: depth20@100ms + kline + ticker', () => {
    const { feed } = makeFeed()
    stubFetch({})
    feed.start()
    const url = MockWebSocket.last().url
    expect(url.startsWith(HOST_A)).toBe(true)
    expect(url).toContain('btcusdt@depth20@100ms')
    expect(url).toContain('btcusdt@kline_1m')
    expect(url).toContain('btcusdt@ticker')
  })

  it('start → connecting, soket açılınca → live', () => {
    const { feed, events } = makeFeed()
    stubFetch({})
    feed.start()
    expect(events[0]).toMatchObject({ type: 'status', status: 'connecting' })
    MockWebSocket.last().simulateOpen()
    expect(events[1]).toMatchObject({ type: 'status', status: 'live' })
  })

  it('soket açılınca REST geçmişi gerçek satır düzeninden çeker', async () => {
    const { feed, events } = makeFeed()
    const { calls } = stubFetch({
      [REST_A]: [
        klineRow(T0 - 120_000, '100', '102', '99', '101', '10', T0 - 60_001),
        klineRow(T0 - 60_000, '101', '103', '100', '102', '12', T0 - 1),
        klineRow(T0, '102', '104', '101', '103', '5', T0 + 59_999),
      ],
    })
    feed.start()
    MockWebSocket.last().simulateOpen()
    await vi.advanceTimersByTimeAsync(0)
    const history = events.find((e) => e.type === 'history')
    expect(history).toBeDefined()
    if (history?.type === 'history') {
      expect(history.candles).toHaveLength(3)
      expect(history.candles.map((c) => c.time)).toEqual([
        (T0 - 120_000) / 1000,
        (T0 - 60_000) / 1000,
        T0 / 1000,
      ])
      // kapanmışlık gerçek closeTime'dan türetilir
      expect(history.candles.map((c) => c.closed)).toEqual([true, true, false])
      expect(history.candles[1]).toMatchObject({
        open: 101,
        high: 103,
        low: 100,
        close: 102,
        volume: 12,
      })
    }
    expect(calls[0]).toContain('/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=500')
  })

  it('geçersiz REST satırları atılır, geçerli olanlar sıralı gelir', async () => {
    const { feed, events } = makeFeed()
    stubFetch({
      [REST_A]: [
        ['bozuk', 'satır'],
        klineRow(T0 - 60_000, '101', '103', '100', '102', '12', T0 - 1),
        klineRow(T0 - 120_000, '100', '102', '99', '101', '10', T0 - 60_001),
        klineRow(T0, '0', '0', '0', '0', '0', T0 + 59_999), // fiyat ≤ 0 → at
      ],
    })
    feed.start()
    MockWebSocket.last().simulateOpen()
    await vi.advanceTimersByTimeAsync(0)
    const history = events.find((e) => e.type === 'history')
    if (history?.type !== 'history') throw new Error('history gelmedi')
    expect(history.candles.map((c) => c.time)).toEqual([
      (T0 - 120_000) / 1000,
      (T0 - 60_000) / 1000,
    ])
  })

  it('birincil REST host yanıt vermezse gerçek yedek host denenir', async () => {
    const { feed, events } = makeFeed()
    const { calls } = stubFetch({
      [REST_A]: 451,
      [REST_B]: [klineRow(T0 - 60_000, '101', '103', '100', '102', '12', T0 - 1)],
    })
    feed.start()
    MockWebSocket.last().simulateOpen()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.some((u) => u.startsWith(REST_A))).toBe(true)
    expect(calls.some((u) => u.startsWith(REST_B))).toBe(true)
    expect(events.filter((e) => e.type === 'history')).toHaveLength(1)
  })

  it('geçmiş mum alınamazsa periyodik olarak yeniden denenir', async () => {
    const { feed, events } = makeFeed()
    const script: Record<string, unknown[] | number | null> = { [REST_A]: null, [REST_B]: null }
    stubFetch(script)
    feed.start()
    MockWebSocket.last().simulateOpen()
    await vi.advanceTimersByTimeAsync(0)
    expect(events.filter((e) => e.type === 'history')).toHaveLength(0)

    script[REST_A] = [klineRow(T0 - 60_000, '101', '103', '100', '102', '12', T0 - 1)]
    await vi.advanceTimersByTimeAsync(HISTORY_RETRY_MS + 10)
    expect(events.filter((e) => e.type === 'history')).toHaveLength(1)
  })

  it('kısmi derinlik (lastUpdateId) → normalize kitap; geriye düşen kimlik atılır', async () => {
    const { feed, events } = makeFeed()
    stubFetch({})
    feed.start()
    MockWebSocket.last().simulateOpen()
    const ws = MockWebSocket.last()
    ws.simulateMessage({
      // gerçek tel formatı: { lastUpdateId, bids, asks } — `e` alanı YOK
      lastUpdateId: 100,
      bids: [
        ['67000', '1'],
        ['66999', '2'],
      ],
      asks: [['67001', '3']],
    })
    ws.simulateMessage({
      lastUpdateId: 99, // eski snapshot → yok sayılır
      bids: [['60000', '9']],
      asks: [['70000', '9']],
    })
    const books = events.filter((e) => e.type === 'book')
    expect(books).toHaveLength(1)
    if (books[0].type === 'book') {
      expect(books[0].book.bids.map((l) => l.price)).toEqual([67000, 66999])
      expect(books[0].book.bids[1].total).toBe(3)
      expect(books[0].book.asks[0].price).toBe(67001)
      expect(books[0].book.lastUpdateId).toBe(100)
    }
  })

  it('kline → mum (kapanmışlık `k.x` ile), ticker → 24s özeti (küçük harf h/l)', () => {
    const { feed, events } = makeFeed()
    stubFetch({})
    feed.start()
    MockWebSocket.last().simulateOpen()
    const ws = MockWebSocket.last()
    ws.simulateMessage({
      e: 'kline',
      k: { t: T0, o: '100', h: '101', l: '99', c: '100.5', v: '10', x: false },
    })
    ws.simulateMessage({
      e: 'kline',
      k: { t: T0, o: '100', h: '101', l: '99', c: '100.6', v: '12', x: true },
    })
    ws.simulateMessage({ e: '24hrTicker', c: '100.6', P: '1.5', h: '102', l: '98', v: '999' })
    const candles = events.filter((e) => e.type === 'candle')
    expect(candles).toHaveLength(2)
    if (candles[0].type === 'candle' && candles[1].type === 'candle') {
      expect(candles[0].candle).toMatchObject({ time: T0 / 1000, closed: false, close: 100.5 })
      expect(candles[1].candle).toMatchObject({ closed: true, close: 100.6, volume: 12 })
    }
    expect(events.find((e) => e.type === 'ticker')).toMatchObject({
      type: 'ticker',
      ticker: { last: 100.6, changePct: 1.5, high24h: 102, low24h: 98, volume24h: 999 },
    })
  })

  it('bozuk JSON ve şemaya uymayan mesaj akışı düşürmez', () => {
    const { feed, events } = makeFeed()
    stubFetch({})
    feed.start()
    MockWebSocket.last().simulateOpen()
    const ws = MockWebSocket.last()
    ws.simulateRaw('bu json değil')
    ws.simulateMessage({ lastUpdateId: 1, bids: [], asks: [['1', '2']] })
    ws.simulateMessage({ e: 'kline', k: { t: T0 } })
    ws.simulateMessage({ e: '24hrTicker', c: '0', P: '0', h: '0', l: '0', v: '0' })
    expect(events.filter((e) => e.type === 'book')).toHaveLength(0)
    expect(events.filter((e) => e.type === 'candle')).toHaveLength(0)
    expect(events.filter((e) => e.type === 'ticker')).toHaveLength(0)
    ws.simulateMessage({
      lastUpdateId: 1,
      bids: [['10', '1']],
      asks: [['11', '1']],
    })
    expect(events.filter((e) => e.type === 'book')).toHaveLength(1)
  })

  it('resmî doküman örneği: `e` alanı olmayan kısmi derinlik yükü kitabı doldurur', async () => {
    const { feed, events } = makeFeed()
    stubFetch({})
    feed.start()
    MockWebSocket.last().simulateOpen()
    const ws = MockWebSocket.last()

    // binance-spot-api-docs → "Partial Book Depth Streams" yükünün birebir kopyası
    ws.simulateMessage({
      lastUpdateId: 160,
      bids: [
        ['0.0024', '10'],
        ['0.0023', '5'],
      ],
      asks: [
        ['0.0026', '100'],
        ['0.0027', '20'],
      ],
    })

    const books = events.filter((e) => e.type === 'book')
    expect(books).toHaveLength(1)
    if (books[0].type === 'book') {
      expect(books[0].book.bids.map((l) => l.price)).toEqual([0.0024, 0.0023])
      expect(books[0].book.asks.map((l) => l.price)).toEqual([0.0026, 0.0027])
      expect(books[0].book.bids[0].qty).toBe(10)
      expect(books[0].book.asks[0].qty).toBe(100)
      expect(books[0].book.bids[1].total).toBe(15)
      expect(books[0].book.lastUpdateId).toBe(160)
    }
  })

  it("fark derinlik akışı (e: 'depthUpdate', b/a) snapshot sanılmaz", async () => {
    const { feed, events } = makeFeed()
    stubFetch({})
    feed.start()
    MockWebSocket.last().simulateOpen()
    const ws = MockWebSocket.last()

    // abone olmadığımız fark derinlik biçimi: bids/asks değil b/a taşır → kitap üretilmez
    ws.simulateMessage({
      e: 'depthUpdate',
      s: 'BTCUSDT',
      U: 157,
      u: 160,
      b: [['67000', '1']],
      a: [['67001', '1']],
    })

    expect(events.filter((e) => e.type === 'book')).toHaveLength(0)
  })

  it('hiçbir kaynak veri vermezse: uydurma mum/fiyat/kitap ÜRETİLMEZ, yalnız durum bildirilir', async () => {
    const { feed, events } = makeFeed()
    stubFetch({ [REST_A]: null, [REST_B]: null })
    feed.start()
    const ws = MockWebSocket.last()
    ws.simulateOpen()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(events.every((e) => e.type === 'status')).toBe(true)
    expect(events.filter((e) => e.type === 'history')).toHaveLength(0)
    expect(events.filter((e) => e.type === 'candle')).toHaveLength(0)
    expect(events.filter((e) => e.type === 'ticker')).toHaveLength(0)
    expect(events.filter((e) => e.type === 'book')).toHaveLength(0)
  })
})

describe('live feed — kopma, yeniden deneme ve host rotasyonu', () => {
  it('kopunca reconnecting, backoff ile yeni bağlantı', async () => {
    const { feed, events } = makeFeed()
    stubFetch({})
    feed.start()
    MockWebSocket.last().simulateOpen()
    MockWebSocket.last().simulateClose(1006)
    expect(events[events.length - 1]).toMatchObject({ type: 'status', status: 'reconnecting' })
    expect(MockWebSocket.instances).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS * 1.25)
    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('her kopmada sıradaki gerçek host denenir', async () => {
    const { feed } = makeFeed()
    stubFetch({})
    feed.start()
    expect(MockWebSocket.last().url.startsWith(HOST_A)).toBe(true)
    MockWebSocket.last().simulateClose(1006)
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS * 3)
    expect(MockWebSocket.last().url.startsWith(HOST_B)).toBe(true)
  })

  it('üst üste kopmalarda status offline olur ama denemeler sürer', async () => {
    const { feed, events } = makeFeed({ offlineAfterAttempts: 3 })
    stubFetch({})
    feed.start()
    MockWebSocket.last().simulateOpen()
    MockWebSocket.last().simulateClose(1006)
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS * 3)
    MockWebSocket.last().simulateClose(1006)
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS * 6)
    MockWebSocket.last().simulateClose(1006)
    expect(events[events.length - 1]).toMatchObject({ type: 'status', status: 'offline' })

    const before = MockWebSocket.instances.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(MockWebSocket.instances.length).toBeGreaterThan(before)
    expect(events[events.length - 1]).toMatchObject({ type: 'status', status: 'offline' })
  })

  it('retryNow() backoff sayacını sıfırlar ve hemen bağlanır', async () => {
    const { feed } = makeFeed({ offlineAfterAttempts: 1 })
    stubFetch({})
    feed.start()
    MockWebSocket.last().simulateOpen()
    MockWebSocket.last().simulateClose(1006)
    const before = MockWebSocket.instances.length
    feed.retryNow()
    expect(MockWebSocket.instances.length).toBe(before + 1)
  })

  it(`${HEARTBEAT_MS} ms mesaj gelmezse soket ölü kabul edilir`, async () => {
    const { feed } = makeFeed()
    stubFetch({})
    feed.start()
    MockWebSocket.last().simulateOpen()
    const before = MockWebSocket.instances.length
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS + 15_000)
    expect(MockWebSocket.instances.length).toBeGreaterThan(before)
  })

  it('mesaj akıyorsa watchdog kesmez', async () => {
    const { feed } = makeFeed()
    stubFetch({})
    feed.start()
    MockWebSocket.last().simulateOpen()
    const ws = MockWebSocket.last()
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(20_000)
      ws.simulateMessage({ e: '24hrTicker', c: '100', P: '0', h: '1', l: '1', v: '1' })
    }
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('setPaused(true) soketi kapatır, false yeniden bağlanır', () => {
    const { feed, events } = makeFeed()
    stubFetch({})
    feed.start()
    MockWebSocket.last().simulateOpen()
    const before = MockWebSocket.instances.length
    feed.setPaused(true)
    expect(MockWebSocket.last().readyState).toBe(3)
    feed.setPaused(false)
    expect(MockWebSocket.instances.length).toBe(before + 1)
    expect(events.filter((e) => e.type === 'status' && e.status === 'live').length).toBeGreaterThan(
      0,
    )
  })

  it('stop() sonrası yeni bağlantı kurulmaz', async () => {
    const { feed } = makeFeed()
    stubFetch({})
    feed.start()
    MockWebSocket.last().simulateOpen()
    feed.stop()
    const after = MockWebSocket.instances.length
    await vi.advanceTimersByTimeAsync(120_000)
    feed.retryNow()
    expect(MockWebSocket.instances).toHaveLength(after)
  })
})
