import type { FeedEvent, MarketFeed, MarketFeedOptions } from '@/entities'
import { DEMO_MODE_FORCED, REST_BASE, WS_BASE } from '@/shared/config/coins'
import { createDemoFeed } from '../lib/demoFeed'
import { createLiveFeed, type LiveFeed } from '../lib/liveFeed'

/**
 * Feed fabrikası:
 * - mode 'demo' veya VITE_DEMO_MODE=1 veya !navigator.onLine → doğrudan demo
 * - mode 'auto' → live dene; 3 deneme / 30 sn içinde kurulamazsa demo'ya düş
 * - pill'e dokunma → forceLive()
 */
export function createMarketFeed(opts: MarketFeedOptions): MarketFeed {
  const handlers = new Set<(e: FeedEvent) => void>()
  const emit = (e: FeedEvent) => {
    for (const h of handlers) h(e)
  }

  const demo = createDemoFeed(opts)
  let live: LiveFeed | null = null
  let mode: 'live' | 'demo' = shouldStartLive(opts) ? 'live' : 'demo'
  let stopped = false

  if (mode === 'live') live = attachLive()
  demo.on(emit)

  function attachLive(): LiveFeed {
    const lf = createLiveFeed({
      symbol: opts.symbol,
      timeframe: opts.timeframe,
      wsBase: opts.wsBase ?? WS_BASE,
      restBase: opts.restBase ?? REST_BASE,
      now: opts.now,
      maxAttempts: opts.maxLiveAttempts ?? 3,
      fallbackAfterMs: opts.fallbackAfterMs ?? 30_000,
    })
    lf.on((e) => {
      if (e.type === 'status' && e.status === 'offline' && mode === 'live' && !stopped) {
        switchToDemo(e.error)
      } else {
        emit(e)
      }
    })
    return lf
  }

  function switchToDemo(error?: string) {
    if (mode === 'demo') return
    mode = 'demo'
    live?.stop()
    live = null
    emit({ type: 'status', status: 'demo', error })
    demo.start()
  }

  return {
    symbol: opts.symbol,
    timeframe: opts.timeframe,
    mode,
    start: () => {
      if (stopped) return
      if (mode === 'live') live?.start()
      else demo.start()
    },
    stop: () => {
      stopped = true
      live?.stop()
      demo.stop()
    },
    setPaused: (p) => {
      live?.setPaused(p)
      demo.setPaused(p)
    },
    forceLive: () => {
      if (stopped || mode === 'live') return
      live = attachLive()
      mode = 'live'
      demo.stop()
      live.start()
    },
    on: (h) => {
      handlers.add(h)
      return () => handlers.delete(h)
    },
  }
}

function shouldStartLive(opts: MarketFeedOptions): boolean {
  if (opts.mode === 'demo') return false
  if (opts.mode === 'live') return true
  if (DEMO_MODE_FORCED) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  return true
}
