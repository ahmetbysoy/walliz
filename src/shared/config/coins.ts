/** Coin metadata ve global sabitler. */

export interface CoinConfig {
  symbol: string
  base: string
  name: string
  /** Duvar tespiti adaptif çarpanı (volatil coin → düşük) */
  wallMultiplier: number
  /** ATR çarpanı: anlamlı hareket eşiği = atrMoveFactor * ATR(14) */
  atrMoveFactor: number
  priceDecimals: number
  /** Demo feed başlangıç fiyatı */
  demoBasePrice: number
  /** Demo feed tick volatilitesi */
  demoVol: number
  /** Demo feed tipik seviye hacmi */
  demoQtyScale: number
}

export const COINS: CoinConfig[] = [
  {
    symbol: 'BTCUSDT',
    base: 'BTC',
    name: 'Bitcoin',
    wallMultiplier: 2.2,
    atrMoveFactor: 0.35,
    priceDecimals: 2,
    demoBasePrice: 67400,
    demoVol: 0.0003,
    demoQtyScale: 2.0,
  },
  {
    symbol: 'ETHUSDT',
    base: 'ETH',
    name: 'Ethereum',
    wallMultiplier: 2.0,
    atrMoveFactor: 0.35,
    priceDecimals: 2,
    demoBasePrice: 3520,
    demoVol: 0.00045,
    demoQtyScale: 40,
  },
  {
    symbol: 'SOLUSDT',
    base: 'SOL',
    name: 'Solana',
    wallMultiplier: 1.8,
    atrMoveFactor: 0.3,
    priceDecimals: 2,
    demoBasePrice: 182,
    demoVol: 0.0006,
    demoQtyScale: 300,
  },
  {
    symbol: 'DOGEUSDT',
    base: 'DOGE',
    name: 'Dogecoin',
    wallMultiplier: 1.4,
    atrMoveFactor: 0.25,
    priceDecimals: 5,
    demoBasePrice: 0.1624,
    demoVol: 0.0009,
    demoQtyScale: 90000,
  },
  {
    symbol: 'AVAXUSDT',
    base: 'AVAX',
    name: 'Avalanche',
    wallMultiplier: 1.7,
    atrMoveFactor: 0.3,
    priceDecimals: 3,
    demoBasePrice: 38.4,
    demoVol: 0.0007,
    demoQtyScale: 600,
  },
]

export function getCoin(symbol: string): CoinConfig {
  return COINS.find((c) => c.symbol === symbol) ?? COINS[0]
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

export const WS_BASE = env.VITE_BINANCE_WS || 'wss://stream.binance.com:9443'
export const REST_BASE = env.VITE_BINANCE_REST || 'https://api.binance.com'
export const DEMO_MODE_FORCED = env.VITE_DEMO_MODE === '1'
export const DEMO_SEED = env.VITE_DEMO_SEED || ''

export const WALL_DETECTION = {
  window: 3,
  maxWalls: 3,
  stableAfterTicks: 5,
} as const

export const DEMO_TICK_MS = 500
export const DEMO_CANDLE_MS = 8_000
