/** Piyasa verisi tipleri (saf tipler — fonksiyon yok). */

export interface Candle {
  /** Mum açılış zamanı (unix saniye) */
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  closed: boolean
}

export interface BookLevel {
  price: number
  /** Seviye hacmi (base coin) */
  qty: number
  /** Touch'tan bu seviyeye kadar kümülatif derinlik */
  total: number
}

export interface BookSnapshot {
  bids: BookLevel[]
  asks: BookLevel[]
  ts: number
  lastUpdateId?: number
}

export type FeedStatus = 'connecting' | 'live' | 'demo' | 'reconnecting' | 'offline'

export interface Ticker {
  last: number
  changePct: number
  volume24h: number
  high24h: number
  low24h: number
  ts: number
}

export type FeedEvent =
  | { type: 'status'; status: FeedStatus; error?: string }
  | { type: 'book'; book: BookSnapshot }
  | { type: 'candle'; candle: Candle }
  | { type: 'ticker'; ticker: Ticker }
  | { type: 'history'; candles: Candle[] }

/** Feed sözleşmesi: live ve demo feed'ler aynı arayüzü uygular. */
export interface MarketFeed {
  readonly symbol: string
  readonly timeframe: string
  readonly mode: 'live' | 'demo'
  start(): void
  stop(): void
  /** Sekme arka plandayken true (pil tasarrufu) */
  setPaused(p: boolean): void
  /** Demo/offline'dan canlı veriye geçmeyi dener */
  forceLive(): void
  on(handler: (e: FeedEvent) => void): () => void
}

export interface MarketFeedOptions {
  symbol: string
  timeframe: string
  mode: 'auto' | 'live' | 'demo'
  wsBase?: string
  restBase?: string
  seed?: number
  now?: () => number
  tickMs?: number
  candleMs?: number
  maxLiveAttempts?: number
  fallbackAfterMs?: number
  /** demo feed: false → timer yok, tick() manuel çağrılır (test) */
  timed?: boolean
}
