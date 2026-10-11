import type { FeedEvent, MarketFeed, MarketFeedOptions } from '@/entities'
import { REST_BASE, REST_FALLBACKS, WS_BASE, WS_FALLBACKS } from '@/shared/config/coins'
import { createLiveFeed, type LiveFeed } from '../lib/liveFeed'

/**
 * Feed giriş noktası — yalnızca gerçek borsa verisi.
 *
 * Simülasyon/mock katmanı yoktur: bağlantı kurulamazsa status `offline` olur ve
 * uygulama veri göstermez (uydurma mum/fiyat/kitap üretilmez). Bağlantı geri
 * geldiğinde aynı feed kaldığı yerden devam eder.
 *
 * Sorumluluklar:
 * - WS + REST istemcisini (liveFeed) kurmak ve yaşam döngüsünü yönetmek
 * - Tarayıcı ağ durumu (online/offline) ile feed'i senkronlamak
 * - `retryNow()` ile kullanıcı aksiyonunu feed'e iletmek
 */
export function createMarketFeed(opts: MarketFeedOptions): MarketFeed {
  const handlers = new Set<(e: FeedEvent) => void>()
  const emit = (e: FeedEvent) => {
    for (const h of handlers) h(e)
  }

  let stopped = false

  const live: LiveFeed = createLiveFeed({
    symbol: opts.symbol,
    timeframe: opts.timeframe,
    wsBase: opts.wsBase ?? WS_BASE,
    wsFallbacks: opts.wsFallbacks ?? WS_FALLBACKS,
    restBase: opts.restBase ?? REST_BASE,
    restFallbacks: opts.restFallbacks ?? REST_FALLBACKS,
    now: opts.now,
    historyLimit: opts.historyLimit,
    offlineAfterAttempts: opts.offlineAfterAttempts,
    isOffline: () => typeof navigator !== 'undefined' && navigator.onLine === false,
  })
  const offLive = live.on(emit)

  const hasWindow = typeof window !== 'undefined'
  const onOnline = () => {
    if (stopped) return
    emit({ type: 'status', status: 'reconnecting', error: 'ag-geri-geldi' })
    live.retryNow()
  }
  const onOffline = () => {
    if (stopped) return
    emit({ type: 'status', status: 'offline', error: 'tarayici-cevrimdisi' })
  }
  if (hasWindow) {
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
  }

  const offlineNow = typeof navigator !== 'undefined' && navigator.onLine === false

  return {
    symbol: opts.symbol,
    timeframe: opts.timeframe,
    mode: 'live',
    start: () => {
      if (stopped) return
      if (offlineNow) emit({ type: 'status', status: 'offline', error: 'tarayici-cevrimdisi' })
      live.start()
    },
    stop: () => {
      stopped = true
      offLive()
      if (hasWindow) {
        window.removeEventListener('online', onOnline)
        window.removeEventListener('offline', onOffline)
      }
      live.stop()
    },
    setPaused: (p) => live.setPaused(p),
    retryNow: () => {
      if (stopped) return
      live.retryNow()
    },
    on: (h) => {
      handlers.add(h)
      return () => handlers.delete(h)
    },
  }
}
