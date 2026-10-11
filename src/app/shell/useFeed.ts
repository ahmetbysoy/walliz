import { useCallback, useEffect, useRef, useState } from 'react'
import type { MarketFeed } from '@/entities'
import { createMarketFeed } from '@/features/market-feed/api/createMarketFeed'
import { useMarketStore } from '@/shared/model/marketStore'

/**
 * Feed yaşam döngüsü: sembol/timeframe/epoch değişince feed yeniden kurulur.
 * - Visibility API: sekme hidden → WS kapat (pil)
 * - forceLive: status pill'den canlı veri denemesi
 */
export function useFeed(ready: boolean) {
  const symbol = useMarketStore((s) => s.symbol)
  const timeframe = useMarketStore((s) => s.timeframe)
  const [epoch, setEpoch] = useState(0)
  const feedRef = useRef<MarketFeed | null>(null)

  const restart = useCallback(() => setEpoch((e) => e + 1), [])
  const forceLive = useCallback(() => {
    feedRef.current?.forceLive()
  }, [])

  useEffect(() => {
    if (!ready) return
    useMarketStore.getState().reset(symbol, timeframe)
    const feed = createMarketFeed({ symbol, timeframe, mode: 'auto' })
    feedRef.current = feed
    const off = feed.on((e) => useMarketStore.getState().apply(e))
    feed.start()
    const onVis = () => feed.setPaused(document.hidden)
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      off()
      feed.stop()
      feedRef.current = null
    }
  }, [ready, symbol, timeframe, epoch])

  return { restart, forceLive }
}
