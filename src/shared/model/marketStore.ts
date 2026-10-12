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
import { MAX_CANDLES } from '@/shared/config/coins'
import { mergeHistory, sameCandleList, upsertCandle } from '@/shared/lib/candles'

export interface MarketState {
  status: FeedStatus
  feedError: string | null
  symbol: string
  timeframe: string
  price: number | null
  ticker: Ticker | null
  book: BookSnapshot | null
  /** Zamana göre ARTAN ve tekil mum listesi (grafik + model tek kaynaktan beslenir) */
  candles: Candle[]
  /**
   * Pencere yapısı değiştiğinde (geçmiş mum birleşmesi / geriye dönük mum düzeltmesi /
   * pencere kırpılması) artar. Grafik bu sayaç değiştiğinde artımlı `update()` yerine
   * tam `setData()` yapar — gerçek feed'lerde mum tekrarı/gelgitmesi çizimi bozamaz.
   */
  candlesRewriteSeq: number
  walls: Wall[]
  features: FeatureVector | null
  lastEventAt: number
  apply: (e: FeedEvent) => void
  setWalls: (walls: Wall[], features: FeatureVector | null) => void
  reset: (symbol: string, timeframe: string) => void
}

/** Kapanmamış mum güncellemesi pencere yapısını değiştirmez (artımlı çizim yeterli). */
function isStructuralChange(existing: Candle[], next: Candle[], incoming: Candle): boolean {
  const last = next[next.length - 1]
  if (!last) return true
  // geriye dönük yerleştirme/tekrar → pencere yapısı değişti
  if (incoming.time < last.time) return true
  // pencere kırpıldı mı? (en eski mum düştüyse grafik baştan çizilmeli)
  if (existing.length === MAX_CANDLES && next.length === MAX_CANDLES) {
    const dropped = existing[0]
    if (dropped && dropped.time !== next[0].time) return true
  }
  return false
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
  candlesRewriteSeq: 0,
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
          const incoming = e.candle
          if (!Number.isFinite(incoming.time) || incoming.time <= 0) return {}
          const candles = upsertCandle(st.candles, incoming)
          if (candles === st.candles) return {}
          const structural = isStructuralChange(st.candles, candles, incoming)
          return {
            candles,
            candlesRewriteSeq: st.candlesRewriteSeq + (structural ? 1 : 0),
            price: incoming.close,
            lastEventAt: Date.now(),
          }
        }
        case 'history': {
          const valid = e.candles.filter((c) => Number.isFinite(c.time) && c.time > 0)
          if (valid.length === 0) return {}
          const candles = mergeHistory(st.candles, valid)
          if (sameCandleList(candles, st.candles)) return {}
          return {
            candles,
            candlesRewriteSeq: st.candlesRewriteSeq + 1,
            lastEventAt: Date.now(),
          }
        }
      }
    }),

  setWalls: (walls, features) => set({ walls, features }),

  reset: (symbol, timeframe) =>
    set((st) => ({
      symbol,
      timeframe,
      status: 'connecting',
      feedError: null,
      price: null,
      ticker: null,
      book: null,
      candles: [],
      // yeni sembol/timeframe → grafik tam yeniden çizilmeli
      candlesRewriteSeq: st.candlesRewriteSeq + 1,
      walls: [],
      features: null,
      lastEventAt: 0,
    })),
}))

export const getMarket = (): MarketState => useMarketStore.getState()
