import { useEffect } from 'react'
import { createWallEngine } from '@/shared/lib/wallEngine'
import { getCoin, WALL_DETECTION } from '@/shared/config/coins'
import { useMarketStore } from '@/shared/model/marketStore'

/**
 * Wall engine döngüsü: book değişince (100ms throttle'lu — book.ts her
 * WS mesajında değişmez, sadece yeni snapshot gelince) worker'a push.
 * Sonuç (walls + features) marketStore'a yazar.
 */
export function useWallEngine(ready: boolean) {
  const symbol = useMarketStore((s) => s.symbol)

  useEffect(() => {
    if (!ready) return
    const engine = createWallEngine()
    let lastBookTs = 0
    const offResult = engine.onResult((r) => {
      useMarketStore.getState().setWalls(r.walls, r.features)
    })
    const offStore = useMarketStore.subscribe((st, prev) => {
      const book = st.book
      if (!book || book.ts === lastBookTs || book === prev.book) return
      lastBookTs = book.ts
      const coin = getCoin(st.symbol)
      engine.push({
        book,
        candles: st.candles,
        multiplier: coin.wallMultiplier,
        window: WALL_DETECTION.window,
        maxWalls: WALL_DETECTION.maxWalls,
        stableAfterTicks: WALL_DETECTION.stableAfterTicks,
      })
    })
    return () => {
      offStore()
      offResult()
      engine.dispose()
    }
  }, [ready, symbol])
}
