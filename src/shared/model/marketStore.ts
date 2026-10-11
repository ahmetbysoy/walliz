import { create } from 'zustand'
import type {
  BookSnapshot,
  Candle,
  FeatureVector,
  FeedEvent,
  FeedStatus,
  Ticker,
  Wall,
} from '@/entities'

const MAX_CANDLES = 500

export interface MarketState {
  status: FeedStatus
  feedError: string | null
  symbol: string
  timeframe: string
  price: number | null
  ticker: Ticker | null
  book: BookSnapshot | null
  candles: Candle[]
  walls: Wall[]
  features: FeatureVector | null
  lastEventAt: number
  apply: (e: FeedEvent) => void
  setWalls: (walls: Wall[], features: FeatureVector | null) => void
  reset: (symbol: string, timeframe: string) => void
}

/**
 * Cross-feature piyasa state'i (feature'lar birbirine import edemediği
 * için runtime state shared/model'de yaşar — bkz. ARCHITECTURE.md).
 */
export const useMarketStore = create<MarketState>()((set) => ({
  status: 'connecting',
  feedError: null,
  symbol: 'BTCUSDT',
  timeframe: '1m',
  price: null,
  ticker: null,
  book: null,
  candles: [],
  walls: [],
  features: null,
  lastEventAt: 0,

  apply: (e) =>
    set((st) => {
      switch (e.type) {
        case 'status':
          return { status: e.status, feedError: e.error ?? null }
        case 'ticker':
          return { ticker: e.ticker, price: e.ticker.last, lastEventAt: e.ticker.ts }
        case 'book':
          return { book: e.book, lastEventAt: e.book.ts }
        case 'candle': {
          const candles = st.candles.slice()
          const last = candles[candles.length - 1]
          if (last && last.time === e.candle.time) {
            candles[candles.length - 1] = e.candle
          } else {
            candles.push(e.candle)
            if (candles.length > MAX_CANDLES) candles.splice(0, candles.length - MAX_CANDLES)
          }
          return { candles, price: e.candle.close, lastEventAt: Date.now() }
        }
        case 'history':
          return { candles: e.candles.slice(-MAX_CANDLES) }
      }
    }),

  setWalls: (walls, features) => set({ walls, features }),

  reset: (symbol, timeframe) =>
    set({
      symbol,
      timeframe,
      status: 'connecting',
      feedError: null,
      price: null,
      ticker: null,
      book: null,
      candles: [],
      walls: [],
      features: null,
      lastEventAt: 0,
    }),
}))

export const getMarket = (): MarketState => useMarketStore.getState()
