import type { Candle, FeedEvent, FeedStatus } from '@/entities'
import {
  HEARTBEAT_MS,
  HISTORY_LIMIT,
  HISTORY_RETRY_MS,
  OFFLINE_AFTER_ATTEMPTS,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  REST_FALLBACKS,
  REST_TIMEOUT_MS,
  WATCHDOG_INTERVAL_MS,
  WS_FALLBACKS,
} from '@/shared/config/coins'
import { buildBookSnapshot } from '@/shared/lib/book'
import { isValidCandle, klineUrl, parseKlineRows } from '@/shared/lib/klines'
import { depth20Schema, klineSchema, tickerSchema, toNumber } from './schemas'

/**
 * Canlı feed: Binance birleşik stream (depth20@100ms + kline + ticker) + REST kline geçmişi.
 *
 * Üretilmiş/simüle edilmiş veri YOKTUR:
 * - Bağlantı kurulamazsa durum `offline` olarak bildirilir, uygulama boş kalır ve
 *   kullanıcıya açıkça söylenir; hiçbir zaman uydurma mum/fiyat/kitap yayınlanmaz.
 * - Bağlantı sürdükçe sonsuz yeniden deneme yapılır (1s → 30s backoff + jitter).
 *
 * Gerçek dünya dayanıklılığı:
 * - WS host rotasyonu: birincil host'a bağlanılamazsa gerçek yedek host'lar denenir.
 * - REST host rotasyonu + zaman aşımı: geçmiş mum için yedek host'lar sırayla denenir.
 * - Heartbeat watchdog: 30 sn mesaj gelmezse soket ölü kabul edilip yeniden bağlanılır.
 * - Sıralama garantisi: geçmiş mumlar zamana göre sıralanır, tekilleştirilir; kapanmışlık
 *   bilgisi Binance'in `kline.closeTime` alanından (gerçek zaman) türetilir.
 * - Derinlik tekilliği: geriye düşen `lastUpdateId` (eski snapshot) atılır.
 * - Görünürlük: sekme gizlenince soket kapatılır (pil), görününce yeniden bağlanılır.
 */

export interface LiveFeedOptions {
  symbol: string
  timeframe: string
  wsBase?: string
  wsFallbacks?: string[]
  restBase?: string
  restFallbacks?: string[]
  now?: () => number
  historyLimit?: number
  offlineAfterAttempts?: number
  /** Tarayıcı ağ durumu: bağlantı yoksa durum 'offline' kalır (gereksiz "bağlanıyor" oyunu yok) */
  isOffline?: () => boolean
}

export interface LiveFeed {
  start(): void
  stop(): void
  setPaused(p: boolean): void
  /** Kullanıcı aksiyonu: backoff sıfırlanır, host rotasyonu yapılır, hemen bağlanılır. */
  retryNow(): void
  on(handler: (e: FeedEvent) => void): () => void
  /** Teşhis amaçlı: mevcut host ve deneme sayısı */
  diagnostics(): { wsHost: string; restHost: string; attempt: number; connected: boolean }
}

export function createLiveFeed(opts: LiveFeedOptions): LiveFeed {
  const now = opts.now ?? Date.now
  const historyLimit = Math.min(1000, Math.max(1, opts.historyLimit ?? HISTORY_LIMIT))
  const offlineAfterAttempts = opts.offlineAfterAttempts ?? OFFLINE_AFTER_ATTEMPTS
  const externallyOffline = (): boolean => {
    try {
      return opts.isOffline?.() === true
    } catch {
      return false
    }
  }

  const wsHosts = [opts.wsBase, ...(opts.wsFallbacks ?? WS_FALLBACKS)].filter(
    (h): h is string => typeof h === 'string' && h.length > 0,
  )
  const restHosts = [opts.restBase, ...(opts.restFallbacks ?? REST_FALLBACKS)].filter(
    (h): h is string => typeof h === 'string' && h.length > 0,
  )

  const handlers = new Set<(e: FeedEvent) => void>()
  const emit = (e: FeedEvent) => {
    for (const h of handlers) h(e)
  }
  const warn = (message: string, detail?: unknown) => {
    if (detail === undefined) console.warn(`[lanka] ${message}`)
    else console.warn(`[lanka] ${message}`, detail)
  }

  let ws: WebSocket | null = null
  let stopped = false
  let paused = false
  let connected = false
  /** Üst üste başarısız bağlanma denemesi (başarılı açılışta sıfırlanır) */
  let attempt = 0
  let hostIndex = 0
  let restIndex = 0
  let lastMsgAt = 0
  let lastBookUpdateId: number | null = null
  let reconnectTimer: number | null = null
  let watchdog: number | null = null
  let historyTimer: number | null = null
  let historyLoaded = false

  const url = (host: string): string => {
    const s = opts.symbol.toLowerCase()
    return `${host}/stream?streams=${s}@depth20@100ms/${s}@kline_${opts.timeframe}/${s}@ticker`
  }

  const clearTimer = (id: number | null): null => {
    if (id !== null) clearTimeout(id)
    return null
  }

  const clearTimers = () => {
    reconnectTimer = clearTimer(reconnectTimer)
    historyTimer = clearTimer(historyTimer)
    if (watchdog !== null) {
      clearInterval(watchdog)
      watchdog = null
    }
  }

  const closeSocket = () => {
    connected = false
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      try {
        ws.close()
      } catch {
        /* kapanmış soket — yoksay */
      }
      ws = null
    }
  }

  /** Kopma sonrası durum bildir ve gecikmeli yeniden bağlanma planla. */
  const scheduleReconnect = (reason: string) => {
    if (stopped || paused) return
    attempt += 1
    const status: FeedStatus =
      externallyOffline() || attempt >= offlineAfterAttempts ? 'offline' : 'reconnecting'
    emit({ type: 'status', status, error: reason })
    if (status === 'offline') {
      warn(`bağlantı kurulamadı (${reason}) — ${attempt} deneme; yeniden denemeler sürüyor`)
    }
    // host rotasyonu: her kopmada sıradaki gerçek host denenir
    if (wsHosts.length > 1) hostIndex = (hostIndex + 1) % wsHosts.length
    const base = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.min(attempt - 1, 5))
    // jitter (±%20): binlerce istemcinin aynı anda yüklenmesini engeller
    const jitter = base * 0.2 * (Math.random() * 2 - 1)
    const delay = Math.max(RECONNECT_BASE_MS, Math.round(base + jitter))
    reconnectTimer = setTimeout(connect, delay) as unknown as number
  }

  /**
   * REST kline geçmişi — gerçek borsa verisi.
   * Host'lar sırayla denenir; hiçbiri yanıt vermezse sessizce vazgeçilmez:
   * `historyLoaded` false kalır ve izleyen taraflar bunu bilir.
   */
  const fetchHistory = async (): Promise<boolean> => {
    const limit = historyLimit
    const attempted: string[] = []
    for (let i = 0; i < restHosts.length; i++) {
      const host = restHosts[(restIndex + i) % restHosts.length]
      attempted.push(host)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REST_TIMEOUT_MS)
      try {
        const res = await fetch(klineUrl(host, opts.symbol, opts.timeframe, limit), {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!res.ok) {
          warn(`geçmiş mum isteği başarısız: ${host} → HTTP ${res.status}`)
          continue
        }
        const rows = (await res.json()) as unknown
        if (!Array.isArray(rows) || rows.length === 0) {
          warn(`geçmiş mum yanıtı boş/geçersiz: ${host}`)
          continue
        }
        const candles = parseKlineRows(rows, now())
        if (candles.length === 0) {
          warn(`geçmiş mum satırları doğrulanamadı: ${host}`)
          continue
        }
        restIndex = (restIndex + i) % restHosts.length
        historyLoaded = true
        emit({ type: 'history', candles })
        return true
      } catch (err) {
        warn(`geçmiş mum isteği hatası: ${host}`, err instanceof Error ? err.message : err)
      } finally {
        clearTimeout(timeout)
      }
    }
    warn(`geçmiş mum alınamadı (denenen host'lar: ${attempted.join(', ')})`)
    return false
  }

  /** Başarısız geçmiş mum isteğini periyodik olarak yeniden dener (gerçek veri gelene kadar). */
  const scheduleHistoryRetry = () => {
    if (stopped || historyLoaded) return
    historyTimer = clearTimer(historyTimer)
    historyTimer = setTimeout(async () => {
      if (stopped || historyLoaded) return
      const ok = await fetchHistory()
      if (!ok) scheduleHistoryRetry()
    }, HISTORY_RETRY_MS) as unknown as number
  }

  const loadHistory = async () => {
    if (historyLoaded) return
    const ok = await fetchHistory()
    if (!ok) scheduleHistoryRetry()
  }

  const connect = () => {
    if (stopped || paused) return
    // zaten açık/bağlanan bir soket varken ikinci bağlantı açılmaz
    if (ws) return
    clearTimers()
    // durum makinemi: ilk deneme 'connecting'; kopma sonrası 'reconnecting';
    // eşik aşıldıysa 'offline' kalır (her denemede aşağı yukarı zıplamaz)
    const status: FeedStatus =
      attempt === 0
        ? lastMsgAt === 0 && !historyLoaded
          ? 'connecting'
          : 'reconnecting'
        : externallyOffline() || attempt >= offlineAfterAttempts
          ? 'offline'
          : 'reconnecting'
    emit({ type: 'status', status })
    const host = wsHosts[hostIndex]
    let settled = false
    try {
      ws = new WebSocket(url(host))
    } catch (err) {
      warn(`WebSocket oluşturulamadı (${host})`, err instanceof Error ? err.message : err)
      scheduleReconnect('ws-yaratilamadi')
      return
    }
    ws.onopen = () => {
      settled = true
      connected = true
      attempt = 0
      lastMsgAt = now()
      lastBookUpdateId = null
      emit({ type: 'status', status: 'live' })
      void loadHistory()
      watchdog = setInterval(() => {
        if (now() - lastMsgAt > HEARTBEAT_MS) {
          warn(`${HEARTBEAT_MS} ms mesaj yok — soket ölü kabul edildi`)
          closeSocket()
          scheduleReconnect('heartbeat-timeout')
        }
      }, WATCHDOG_INTERVAL_MS) as unknown as number
    }
    ws.onmessage = (ev: MessageEvent) => {
      lastMsgAt = now()
      if (typeof ev.data === 'string') handleRaw(ev.data)
    }
    ws.onerror = () => {
      // onclose tetiklenir; burada sadece teşhis
      if (!settled) warn(`WS hatası (${host})`)
    }
    ws.onclose = (ev: CloseEvent) => {
      closeSocket()
      if (stopped || paused) return
      const reason = ev?.code ? `ws-kopustu:${ev.code}` : 'ws-kopustu'
      scheduleReconnect(reason)
    }
  }

  const handleRaw = (text: string) => {
    let msg: unknown
    try {
      msg = JSON.parse(text)
    } catch {
      // Binance {"result":null,"id":...} gibi yanıt veya bozuk paket — akışı düşürme
      return
    }
    if (!msg || typeof msg !== 'object') return
    const data = (msg as { data?: unknown }).data ?? msg
    if (!data || typeof data !== 'object') return
    const d = data as Record<string, unknown>

    if (d.e === 'depth20') {
      const parsed = depth20Schema.safeParse(data)
      if (!parsed.success) {
        warn('geçersiz depth20 mesajı atlandı')
        return
      }
      // eski snapshot (geriye düşen update id) kitabı bozar → atla
      const updateId = parsed.data.u
      if (
        typeof updateId === 'number' &&
        lastBookUpdateId !== null &&
        updateId < lastBookUpdateId
      ) {
        return
      }
      if (typeof updateId === 'number') lastBookUpdateId = updateId
      const book = buildBookSnapshot(
        parsed.data.bids.map(([p, q]) => [String(p), String(q)] as [string, string]),
        parsed.data.asks.map(([p, q]) => [String(p), String(q)] as [string, string]),
        now(),
        updateId,
      )
      emit({ type: 'book', book })
    } else if (d.e === 'kline') {
      const parsed = klineSchema.safeParse(data)
      if (!parsed.success) {
        warn('geçersiz kline mesajı atlandı')
        return
      }
      const k = parsed.data.k
      const candle: Candle = {
        time: Math.floor(k.t / 1000),
        open: toNumber(k.o),
        high: toNumber(k.h),
        low: toNumber(k.l),
        close: toNumber(k.c),
        volume: toNumber(k.v),
        closed: k.x,
      }
      if (!isValidCandle(candle)) {
        warn('kline değerleri tutarsız (fiyat ≤ 0) — atlandı')
        return
      }
      emit({ type: 'candle', candle })
    } else if (d.e === '24hrTicker') {
      const parsed = tickerSchema.safeParse(data)
      if (!parsed.success) {
        warn('geçersiz ticker mesajı atlandı')
        return
      }
      const ticker = {
        last: toNumber(parsed.data.c),
        changePct: toNumber(parsed.data.P),
        volume24h: toNumber(parsed.data.v),
        high24h: toNumber(parsed.data.H),
        low24h: toNumber(parsed.data.L),
        ts: now(),
      }
      if (!Number.isFinite(ticker.last) || ticker.last <= 0) {
        warn('ticker son fiyatı geçersiz — atlandı')
        return
      }
      emit({ type: 'ticker', ticker })
    }
  }

  return {
    start: () => {
      if (stopped) {
        stopped = false
      }
      connect()
    },
    stop: () => {
      stopped = true
      clearTimers()
      closeSocket()
    },
    setPaused: (p: boolean) => {
      if (paused === p) return
      paused = p
      if (p) {
        clearTimers()
        closeSocket()
      } else if (!stopped) {
        connect()
      }
    },
    retryNow: () => {
      if (stopped) return
      attempt = 0
      historyLoaded = false
      clearTimers()
      closeSocket()
      connect()
    },
    on: (h) => {
      handlers.add(h)
      return () => handlers.delete(h)
    },
    diagnostics: () => ({
      wsHost: wsHosts[hostIndex],
      restHost: restHosts[restIndex],
      attempt,
      connected,
    }),
  }
}
