import type { FeedEvent, MarketFeedOptions, Ticker } from '@/entities'
import { DEMO_CANDLE_MS, DEMO_SEED, DEMO_TICK_MS, getCoin } from '@/shared/config/coins'
import { buildBookSnapshot } from '@/shared/lib/book'
import { hashSeed } from '@/shared/lib/math'
import { chance, gaussian, mulberry32, pick, rangeInt } from './demoRng'
import type { MarketFeed, Candle, BookSnapshot } from '@/entities'

/**
 * Demo feed: seed'li RNG ile deterministik piyasa simülasyonu.
 * - 180 mum geçmiş + canlı random-walk
 * - kitaba periyodik duvar yerleştirir (20–60 tick ömür)
 * - `timed: false` + `tick()` ile testte tamamen deterministik akış
 */

const HISTORY_CANDLES = 180

export interface DemoFeed extends MarketFeed {
  /** Manuel adım (timed: false modu için) */
  tick(): void
}

interface ActiveWall {
  side: 'bid' | 'ask'
  index: number
  qtyMult: number
  untilTick: number
}

export function createDemoFeed(opts: MarketFeedOptions): DemoFeed {
  const coin = getCoin(opts.symbol)
  const now = opts.now ?? Date.now
  const tickMs = opts.tickMs ?? DEMO_TICK_MS
  const candleMs = opts.candleMs ?? DEMO_CANDLE_MS
  const seed = opts.seed ?? hashSeed(`${opts.symbol}:${opts.timeframe}:${DEMO_SEED}`)
  const rng = mulberry32(seed)

  const handlers = new Set<(e: FeedEvent) => void>()
  const emit = (e: FeedEvent) => {
    for (const h of handlers) h(e)
  }

  const align = (t: number) => Math.floor(t / candleMs) * candleMs

  // ---- geçmiş mum üret (deterministik) ----
  const history: Candle[] = []
  let hTime = align(now()) - HISTORY_CANDLES * candleMs
  let hPrice = coin.demoBasePrice * (1 + gaussian(rng) * 0.01)
  for (let i = 0; i < HISTORY_CANDLES; i++) {
    const open = hPrice
    let high = open
    let low = open
    let close = open
    for (let s = 0; s < 4; s++) {
      close = close * Math.exp(gaussian(rng) * coin.demoVol)
      high = Math.max(high, close)
      low = Math.min(low, close)
    }
    const volume = coin.demoQtyScale * (0.5 + rng() * 1.5)
    history.push({ time: hTime / 1000, open, high, low, close, volume, closed: true })
    hPrice = close
    hTime += candleMs
  }

  let price = history[history.length - 1].close
  const dayOpen = history[0].open
  let dayHigh = history[0].high
  let dayLow = history[0].low
  let dayVolume = 0
  for (const c of history) {
    dayHigh = Math.max(dayHigh, c.high)
    dayLow = Math.min(dayLow, c.low)
    dayVolume += c.volume
  }

  let tickCount = 0
  let activeWalls: ActiveWall[] = []
  let candle: Candle | null = null
  let candleWindow = 0
  let timer: number | null = null
  let paused = false
  let stopped = false

  const makeBook = (t: number): BookSnapshot => {
    const base = price
    const bids: [string, string][] = []
    const asks: [string, string][] = []
    const wallMult = (side: 'bid' | 'ask', i: number): number =>
      activeWalls.find((w) => w.side === side && w.index === i)?.qtyMult ?? 1
    for (let i = 1; i <= 10; i++) {
      const gap = base * (0.0004 * i * (0.6 + rng() * 0.8))
      const bidQty = coin.demoQtyScale * Math.exp(gaussian(rng) * 0.7) * wallMult('bid', i)
      const askQty = coin.demoQtyScale * Math.exp(gaussian(rng) * 0.7) * wallMult('ask', i)
      bids.push([(base - gap).toFixed(coin.priceDecimals + 2), bidQty.toFixed(3)])
      asks.push([(base + gap).toFixed(coin.priceDecimals + 2), askQty.toFixed(3)])
    }
    return buildBookSnapshot(bids, asks, t)
  }

  const manageWalls = (): void => {
    activeWalls = activeWalls.filter((w) => w.untilTick > tickCount)
    if (activeWalls.length < 2 && chance(rng, 0.05)) {
      activeWalls.push({
        side: pick(rng, ['bid', 'ask'] as const),
        index: rangeInt(rng, 2, 7),
        qtyMult: rangeInt(rng, 8, 25),
        untilTick: tickCount + rangeInt(rng, 20, 60),
      })
    }
  }

  const buildTicker = (t: number): Ticker => ({
    last: price,
    changePct: (price / dayOpen - 1) * 100,
    volume24h: dayVolume,
    high24h: dayHigh,
    low24h: dayLow,
    ts: t,
  })

  const step = (): void => {
    if (stopped || paused) return
    const t = now()
    tickCount++
    price = price * Math.exp(gaussian(rng) * coin.demoVol)
    dayHigh = Math.max(dayHigh, price)
    dayLow = Math.min(dayLow, price)

    manageWalls()

    const cTime = align(t)
    if (!candle || cTime !== candleWindow) {
      if (candle) {
        candle.closed = true
        // kopya yayınla: yayınlanan obje asla mutasyona uğramaz (store/React bütünlüğü)
        emit({ type: 'candle', candle: { ...candle } })
      }
      candleWindow = cTime
      candle = {
        time: cTime / 1000,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0,
        closed: false,
      }
    } else {
      candle.high = Math.max(candle.high, price)
      candle.low = Math.min(candle.low, price)
      candle.close = price
    }
    const tickVolume = coin.demoQtyScale * (0.02 + rng() * 0.1)
    candle.volume += tickVolume
    dayVolume += tickVolume

    emit({ type: 'candle', candle: { ...candle } })
    emit({ type: 'ticker', ticker: buildTicker(t) })
    emit({ type: 'book', book: makeBook(t) })

    if (opts.timed !== false) {
      timer = setTimeout(step, tickMs)
    }
  }

  const api: DemoFeed = {
    symbol: opts.symbol,
    timeframe: opts.timeframe,
    mode: 'demo',
    start: () => {
      stopped = false
      emit({ type: 'status', status: 'demo' })
      emit({ type: 'history', candles: history })
      if (opts.timed !== false && timer === null) step()
    },
    tick: () => step(),
    stop: () => {
      stopped = true
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    },
    setPaused: (p: boolean) => {
      paused = p
      if (!p && opts.timed !== false && timer === null && !stopped) step()
    },
    forceLive: () => {
      /* demo no-op — controller üstlenir */
    },
    on: (h) => {
      handlers.add(h)
      return () => handlers.delete(h)
    },
  }
  return api
}
