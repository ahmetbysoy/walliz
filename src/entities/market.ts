/** Piyasa verisi tipleri (saf tipler — fonksiyon yok). */

export interface Candle {
  /** Mum açılış zamanı (unix saniye) */
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  /** Borsa mumu kapattı mı? (Binance `k.x`) Kapanmamış mum canlı güncellenir. */
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

/**
 * Feed durumu — yalnızca gerçek bağlantının hâli.
 * Veri üretilen bir "mod" yoktur; bağlantı yoksa uygulama boş kalır ve bunu açıkça söyler.
 */
export type FeedStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'

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

/**
 * Feed sözleşmesi: canlı borsa verisi.
 * Tüm alanlar gerçek Binance WS/REST akışından gelir; üretilmiş veri yoktur.
 */
export interface MarketFeed {
  readonly symbol: string
  readonly timeframe: string
  readonly mode: 'live'
  start(): void
  stop(): void
  /** Sekme arka plandayken true (pil tasarrufu) */
  setPaused(p: boolean): void
  /** Kopmuş/offline feed'i hemen yeniden denemeye zorlar (kullanıcı aksiyonu). */
  retryNow(): void
  on(handler: (e: FeedEvent) => void): () => void
}

export interface MarketFeedOptions {
  symbol: string
  timeframe: string
  wsBase?: string
  /** Birincil WS host'una bağlanılamazsa sırayla denenecek gerçek borsa host'ları */
  wsFallbacks?: string[]
  restBase?: string
  /** Birincil REST host'u yanıt vermezse sırayla denenecek gerçek borsa host'ları */
  restFallbacks?: string[]
  now?: () => number
  /** REST'ten çekilecek geçmiş mum adedi (1..1000) */
  historyLimit?: number
  /** Bu kadar üst üste başarısız denemeden sonra status 'offline' olur (denemeler sürer) */
  offlineAfterAttempts?: number
}
