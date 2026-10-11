import type { FeedEvent } from '@/entities'
import { buildBookSnapshot } from '@/shared/lib/book'
import { depth20Schema, klineSchema, tickerSchema, toNumber } from './schemas'

/**
 * Live feed: Binance birleşik stream (depth20@100ms + kline + ticker).
 * - exponential backoff (1→30s), heartbeat 30s
 * - geçersiz mesaj → log + atla (stream düşmez)
 * - REST kline geçmişi ile seed
 */

const BACKOFF_BASE = 1000
const BACKOFF_MAX = 30_000
const HEARTBEAT_MS = 30_000
const WATCHDOG_INTERVAL_MS = 10_000

export interface LiveFeedOptions {
  symbol: string
  timeframe: string
  wsBase: string
  restBase: string
  now?: () => number
  maxAttempts?: number
  fallbackAfterMs?: number
}

export interface LiveFeed {
  start(): void
  stop(): void
  setPaused(p: boolean): void
  on(handler: (e: FeedEvent) => void): () => void
}

export function createLiveFeed(opts: LiveFeedOptions): LiveFeed {
  const now = opts.now ?? Date.now
  const maxAttempts = opts.maxAttempts ?? 3
  const fallbackAfterMs = opts.fallbackAfterMs ?? 30_000

  const handlers = new Set<(e: FeedEvent) => void>()
  const emit = (e: FeedEvent) => {
    for (const h of handlers) h(e)
  }

  let ws: WebSocket | null = null
  let stopped = false
  let paused = false
  let attempt = 0
  let firstFailAt: number | null = null
  let lastMsgAt = 0
  let reconnectTimer: number | null = null
  let watchdog: number | null = null
  let fallbackEmitted = false

  const url = (): string => {
    const s = opts.symbol.toLowerCase()
    return `${opts.wsBase}/stream?streams=${s}@depth20@100ms/${s}@kline_${opts.timeframe}/${s}@ticker`
  }

  const clearTimers = () => {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (watchdog !== null) {
      clearInterval(watchdog)
      watchdog = null
    }
  }

  const closeSocket = () => {
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      try {
        ws.close()
      } catch {
        /* noop */
      }
      ws = null
    }
  }

  const fail = (reason: string) => {
    if (stopped || paused) return
    attempt++
    if (firstFailAt === null) firstFailAt = now()
    const downFor = now() - firstFailAt
    clearTimers()
    closeSocket()
    if (attempt >= maxAttempts || downFor >= fallbackAfterMs) {
      if (!fallbackEmitted) {
        fallbackEmitted = true
        emit({ type: 'status', status: 'offline', error: reason })
      }
      return
    }
    emit({ type: 'status', status: 'reconnecting', error: reason })
    const delay = Math.min(BACKOFF_MAX, BACKOFF_BASE * 2 ** (attempt - 1))
    reconnectTimer = setTimeout(connect, delay)
  }

  const fetchHistory = async () => {
    try {
      const res = await fetch(
        `${opts.restBase}/api/v3/klines?symbol=${opts.symbol}&interval=${opts.timeframe}&limit=300`,
      )
      if (!res.ok) return
      const rows = (await res.json()) as unknown
      if (!Array.isArray(rows)) return
      const candles = rows
        .filter((r): r is unknown[] => Array.isArray(r) && r.length >= 6)
        .map((r, i) => ({
          time: Math.floor(toNumber(r[0] as string | number) / 1000),
          open: toNumber(r[1] as string | number),
          high: toNumber(r[2] as string | number),
          low: toNumber(r[3] as string | number),
          close: toNumber(r[4] as string | number),
          volume: toNumber(r[5] as string | number),
          closed: i < rows.length - 1,
        }))
      if (candles.length > 0) emit({ type: 'history', candles })
    } catch {
      /* offline / erişilemez — history yok */
    }
  }

  const connect = () => {
    if (stopped || paused) return
    clearTimers()
    emit({
      type: 'status',
      status: attempt === 0 && !fallbackEmitted ? 'connecting' : 'reconnecting',
    })
    let opened = false
    try {
      ws = new WebSocket(url())
    } catch {
      fail('ws-yaratilamadi')
      return
    }
    ws.onopen = () => {
      opened = true
      attempt = 0
      firstFailAt = null
      lastMsgAt = now()
      emit({ type: 'status', status: 'live' })
      void fetchHistory()
      watchdog = setInterval(() => {
        if (now() - lastMsgAt > HEARTBEAT_MS) {
          closeSocket()
          fail('heartbeat-timeout')
        }
      }, WATCHDOG_INTERVAL_MS)
    }
    ws.onmessage = (ev: MessageEvent) => {
      lastMsgAt = now()
      if (typeof ev.data === 'string') handleRaw(ev.data)
    }
    ws.onerror = () => {
      /* onclose tetiklenir */
    }
    ws.onclose = () => {
      void opened
      if (stopped) return
      fail('ws-kopustu')
    }
  }

  const handleRaw = (text: string) => {
    let msg: unknown
    try {
      msg = JSON.parse(text)
    } catch {
      return
    }
    if (!msg || typeof msg !== 'object') return
    const data = (msg as { data?: unknown }).data ?? msg
    if (!data || typeof data !== 'object') return
    const d = data as Record<string, unknown>

    if (d.e === 'depth20') {
      const parsed = depth20Schema.safeParse(data)
      if (!parsed.success) {
        console.debug('[lanka] geçersiz depth20 mesajı atlandı')
        return
      }
      const book = buildBookSnapshot(
        parsed.data.bids.map(([p, q]) => [String(p), String(q)] as [string, string]),
        parsed.data.asks.map(([p, q]) => [String(p), String(q)] as [string, string]),
        now(),
        parsed.data.u,
      )
      emit({ type: 'book', book })
    } else if (d.e === 'kline') {
      const parsed = klineSchema.safeParse(data)
      if (!parsed.success) {
        console.debug('[lanka] geçersiz kline mesajı atıldı')
        return
      }
      const k = parsed.data.k
      emit({
        type: 'candle',
        candle: {
          time: Math.floor(k.t / 1000),
          open: toNumber(k.o),
          high: toNumber(k.h),
          low: toNumber(k.l),
          close: toNumber(k.c),
          volume: toNumber(k.v),
          closed: k.x,
        },
      })
    } else if (d.e === '24hrTicker') {
      const parsed = tickerSchema.safeParse(data)
      if (!parsed.success) {
        console.debug('[lanka] geçersiz ticker mesajı atıldı')
        return
      }
      emit({
        type: 'ticker',
        ticker: {
          last: toNumber(parsed.data.c),
          changePct: toNumber(parsed.data.P),
          volume24h: toNumber(parsed.data.v),
          high24h: toNumber(parsed.data.H),
          low24h: toNumber(parsed.data.L),
          ts: now(),
        },
      })
    }
  }

  return {
    start: () => {
      if (!stopped) connect()
    },
    stop: () => {
      stopped = true
      clearTimers()
      closeSocket()
    },
    setPaused: (p: boolean) => {
      paused = p
      if (p) {
        clearTimers()
        closeSocket()
      } else if (!stopped) {
        connect()
      }
    },
    on: (h) => {
      handlers.add(h)
      return () => handlers.delete(h)
    },
  }
}
