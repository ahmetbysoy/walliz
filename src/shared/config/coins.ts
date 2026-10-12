/** Coin metadata, borsa uç noktaları ve global sabitler. */

export interface CoinConfig {
  symbol: string
  base: string
  name: string
  /** Duvar tespiti adaptif çarpanı (volatil coin → düşük) */
  wallMultiplier: number
  /** ATR çarpanı: anlamlı hareket eşiği = atrMoveFactor * ATR(14) */
  atrMoveFactor: number
  priceDecimals: number
}

export const COINS: CoinConfig[] = [
  {
    symbol: 'BTCUSDT',
    base: 'BTC',
    name: 'Bitcoin',
    wallMultiplier: 2.2,
    atrMoveFactor: 0.35,
    priceDecimals: 2,
  },
  {
    symbol: 'ETHUSDT',
    base: 'ETH',
    name: 'Ethereum',
    wallMultiplier: 2.0,
    atrMoveFactor: 0.35,
    priceDecimals: 2,
  },
  {
    symbol: 'SOLUSDT',
    base: 'SOL',
    name: 'Solana',
    wallMultiplier: 1.8,
    atrMoveFactor: 0.3,
    priceDecimals: 2,
  },
  {
    symbol: 'DOGEUSDT',
    base: 'DOGE',
    name: 'Dogecoin',
    wallMultiplier: 1.4,
    atrMoveFactor: 0.25,
    priceDecimals: 5,
  },
  {
    symbol: 'AVAXUSDT',
    base: 'AVAX',
    name: 'Avalanche',
    wallMultiplier: 1.7,
    atrMoveFactor: 0.3,
    priceDecimals: 3,
  },
]

export function getCoin(symbol: string): CoinConfig {
  return COINS.find((c) => c.symbol === symbol) ?? COINS[0]
}

export function isKnownSymbol(symbol: string): boolean {
  return COINS.some((c) => c.symbol === symbol)
}

export interface Timeframe {
  id: string
  label: string
  ms: number
}

export const TIMEFRAMES: Timeframe[] = [
  { id: '1m', label: '1m', ms: 60_000 },
  { id: '5m', label: '5m', ms: 300_000 },
  { id: '15m', label: '15m', ms: 900_000 },
  { id: '1h', label: '1h', ms: 3_600_000 },
]

export function getTimeframe(id: string): Timeframe {
  return TIMEFRAMES.find((t) => t.id === id) ?? TIMEFRAMES[0]
}

// Vite dışı ortamlarda (tsx backtest, bare node) import.meta.env tanımsız olabilir
const env: Record<string, string | undefined> =
  typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env
    ? (import.meta as { env: Record<string, string> }).env
    : {}

function hostList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback
  const list = raw
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  return list.length > 0 ? list : fallback
}

/**
 * Gerçek borsa uç noktaları (Binance).
 * - `${}@depth20@100ms` + `${}@kline_*` + `${}@ticker` birleşik stream (canlı)
 * - `/api/v3/klines` geçmiş mum (REST)
 * Yedek host'lar gerçek Binance uç noktalarıdır: birincil host'a erişilemezse
 * (bölgesel blok / 451 / geçici kesinti) veri yine gerçek borsadan gelir.
 */
export const WS_BASE = env.VITE_BINANCE_WS || 'wss://stream.binance.com:9443'
export const WS_FALLBACKS = hostList(env.VITE_BINANCE_WS_FALLBACKS, [
  'wss://stream.binance.com:443',
  'wss://data-stream.binance.vision',
])

export const REST_BASE = env.VITE_BINANCE_REST || 'https://api.binance.com'
export const REST_FALLBACKS = hostList(env.VITE_BINANCE_REST_FALLBACKS, [
  'https://data-api.binance.vision',
])

/** Grafikte tutulan ve REST'ten çekilen mum adedi (Binance tek istekte en çok 1000 verir) */
export const MAX_CANDLES = 500
export const HISTORY_LIMIT = MAX_CANDLES

/** Bağlantı sağlığı eşikleri (ms) */
export const RECONNECT_BASE_MS = 1_000
export const RECONNECT_MAX_MS = 30_000
export const HEARTBEAT_MS = 30_000
export const WATCHDOG_INTERVAL_MS = 10_000
export const REST_TIMEOUT_MS = 8_000
/** Üst üste bu kadar kopma sonrası status 'offline' (denemeler yine sürer) */
export const OFFLINE_AFTER_ATTEMPTS = 5
/** Geçmiş mum alınamazsa yeniden deneme aralığı (ms) */
export const HISTORY_RETRY_MS = 20_000

export const WALL_DETECTION = {
  window: 3,
  maxWalls: 3,
  stableAfterTicks: 5,
} as const
