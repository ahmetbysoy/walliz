import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeedEvent } from '@/entities'
import { createLiveFeed } from '@/features/market-feed/lib/liveFeed'

/**
 * Binance tel formatı sözleşme testi.
 *
 * Yükler resmî dokümandan BİREBİR kopyalanmıştır
 * (github.com/binance/binance-spot-api-docs → web-socket-streams.md):
 *   · Partial Book Depth Streams (`<symbol>@depth20@100ms`) → { lastUpdateId, bids, asks }
 *     — bu akışta `e` (event type) alanı YOKTUR
 *   · Kline/Candlestick Streams (`<symbol>@kline_<interval>`) → { e: "kline", k: {…} }
 *   · Individual Symbol Ticker Streams (`<symbol>@ticker`) → { e: "24hrTicker", … }
 *
 * Amaç: feed'in ayrıştırma varsayımları ile borsanın gerçek yükü arasındaki sapmayı
 * erken yakalamak. Bu test kırılırsa feed gerçek borsa verisini işleyemiyor demektir
 * (uygulamada orderbook/duvar/tahmin katmanları sessizce boş kalır).
 *
 * Transport taklidi yalnızca soketi taşır; mesaj içerikleri uydurma değil, dokümandaki
 * gerçek alan adları/düzenleridir.
 */

const HOST = 'wss://wire.test'
const REST = 'https://wire-rest.test'
const T0 = 1_700_000_000_000

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
  /** Birleşik stream sarmalayıcısı: {"stream":"...","data":{...}} */
  simulateMessage(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify({ stream: 'btcusdt@x', data: obj }) })
  }
}

function makeFeed() {
  const events: FeedEvent[] = []
  const feed = createLiveFeed({
    symbol: 'BTCUSDT',
    timeframe: '1m',
    wsBase: HOST,
    wsFallbacks: [],
    restBase: REST,
    restFallbacks: [],
  })
  feed.on((e) => events.push(e))
  return { feed, events }
}

/** Geçmiş mum isteği testin konusu değil: boş yanıt ver, akışı etkilemesin. */
function stubFetchEmpty() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })),
  )
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

function openFeed() {
  const { feed, events } = makeFeed()
  stubFetchEmpty()
  feed.start()
  MockWebSocket.last().simulateOpen()
  return { feed, events, ws: MockWebSocket.last() }
}

describe('Binance tel formatı sözleşmesi (resmî doküman yükleri)', () => {
  it('Partial Book Depth Streams: `e` alanı yok, güncelleme kimliği lastUpdateId', async () => {
    const { events, ws } = openFeed()

    const payload = {
      lastUpdateId: 160,
      bids: [
        ['0.0024', '10'],
        ['0.0023', '5'],
      ],
      asks: [
        ['0.0026', '100'],
        ['0.0027', '20'],
      ],
    }
    // sözleşmenin özü: kısmi derinlik yükünde olay tipi alanı bulunmaz
    expect(Object.keys(payload)).not.toContain('e')

    ws.simulateMessage(payload)

    const books = events.filter((e) => e.type === 'book')
    expect(books).toHaveLength(1)
    if (books[0].type === 'book') {
      expect(books[0].book.lastUpdateId).toBe(160)
      expect(books[0].book.bids.map((l) => l.price)).toEqual([0.0024, 0.0023])
      expect(books[0].book.asks.map((l) => l.price)).toEqual([0.0026, 0.0027])
      expect(books[0].book.bids.map((l) => l.qty)).toEqual([10, 5])
      expect(books[0].book.asks.map((l) => l.qty)).toEqual([100, 20])
      expect(books[0].book.bids[1].total).toBe(15)
      expect(books[0].book.asks[1].total).toBe(120)
    }
  })

  it('Kline/Candlestick Streams: k alanındaki gerçek fiyat/hacim alanları okunur', async () => {
    const { events, ws } = openFeed()

    ws.simulateMessage({
      e: 'kline',
      E: 1672515782136,
      s: 'BNBBTC',
      k: {
        t: 1672515780000,
        T: 1672515839999,
        s: 'BNBBTC',
        i: '1m',
        f: 100,
        L: 200,
        o: '0.0010',
        c: '0.0020',
        h: '0.0025',
        l: '0.0015',
        v: '1000',
        n: 100,
        x: false,
        q: '1.0000',
        V: '500',
        Q: '0.500',
        B: '123456',
      },
    })

    const candles = events.filter((e) => e.type === 'candle')
    expect(candles).toHaveLength(1)
    if (candles[0].type === 'candle') {
      expect(candles[0].candle).toEqual({
        time: 1672515780,
        open: 0.001,
        high: 0.0025,
        low: 0.0015,
        close: 0.002,
        volume: 1000,
        closed: false,
      })
    }
  })

  it('Individual Symbol Ticker Streams: 24s değişim/hacim alanları okunur', async () => {
    const { events, ws } = openFeed()

    ws.simulateMessage({
      e: '24hrTicker',
      E: 1672515782136,
      s: 'BNBBTC',
      p: '0.0015',
      P: '250.00',
      w: '0.0018',
      x: '0.0009',
      c: '0.0025',
      Q: '10',
      b: '0.0024',
      B: '10',
      a: '0.0026',
      A: '100',
      o: '0.0010',
      h: '0.0025',
      l: '0.0010',
      v: '10000',
      q: '18',
      O: 0,
      C: 86400000,
      F: 0,
      L: 18150,
      n: 18151,
    })

    const tickers = events.filter((e) => e.type === 'ticker')
    expect(tickers).toHaveLength(1)
    if (tickers[0].type === 'ticker') {
      expect(tickers[0].ticker).toMatchObject({
        last: 0.0025,
        changePct: 250,
        high24h: 0.0025,
        low24h: 0.001,
        volume24h: 10000,
      })
    }
  })

  it('ticker: büyük harf `L` (son işlem kimliği) 24s düşük fiyat olarak OKUNMAZ', async () => {
    const { events, ws } = openFeed()

    ws.simulateMessage({
      e: '24hrTicker',
      c: '67000',
      P: '0.10',
      h: '67200',
      l: '66500',
      v: '1234',
      // resmî yükte büyük harf L "Last trade Id" alanıdır; fiyat değildir
      L: 18150,
      F: 0,
    })

    const tickers = events.filter((e) => e.type === 'ticker')
    expect(tickers).toHaveLength(1)
    if (tickers[0].type === 'ticker') {
      expect(tickers[0].ticker.high24h).toBe(67200)
      expect(tickers[0].ticker.low24h).toBe(66500)
      expect(tickers[0].ticker.high24h).not.toBe(18150)
      expect(tickers[0].ticker.low24h).not.toBe(18150)
    }
  })

  it('üç akış aynı bağlantıda karışık geldiğinde de ayrıştırma doğru kalır', async () => {
    const { events, ws } = openFeed()

    ws.simulateMessage({
      lastUpdateId: 161,
      bids: [['67000', '1.5']],
      asks: [['67001', '2.5']],
    })
    ws.simulateMessage({
      e: 'kline',
      k: { t: 1_700_000_000_000, o: '67000', h: '67100', l: '66900', c: '67050', v: '12', x: true },
    })
    ws.simulateMessage({
      e: '24hrTicker',
      c: '67050',
      P: '-0.75',
      h: '68000',
      l: '66000',
      v: '900',
    })

    expect(events.filter((e) => e.type === 'book')).toHaveLength(1)
    expect(events.filter((e) => e.type === 'candle')).toHaveLength(1)
    expect(events.filter((e) => e.type === 'ticker')).toHaveLength(1)
  })
})
