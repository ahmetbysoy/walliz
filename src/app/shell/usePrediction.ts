import { useEffect } from 'react'
import { toast } from 'sonner'
import { createPredictionEngine } from '@/features/prediction/lib/predictionEngine'
import { getCoin } from '@/shared/config/coins'
import { haptic } from '@/shared/lib/haptics'
import { useMarketStore } from '@/shared/model/marketStore'
import { useLearningStore } from '@/shared/model/learningStore'

/** Tahmin döngüsü: kapalı mum → çözümlenme + yeni tahmin (haptic + toast). */
export function usePrediction(ready: boolean) {
  const symbol = useMarketStore((s) => s.symbol)
  const timeframe = useMarketStore((s) => s.timeframe)

  useEffect(() => {
    if (!ready) return
    const coin = getCoin(symbol)
    const engine = createPredictionEngine({
      getCandleHistory: () => useMarketStore.getState().candles,
      getBook: () => useMarketStore.getState().book,
      getWalls: () => useMarketStore.getState().walls,
      getFeatures: () => useMarketStore.getState().features,
      getLearning: () => useLearningStore.getState().state,
      updateLearning: (fn) => useLearningStore.getState().update(fn),
      coinConfig: { symbol, timeframe, atrMoveFactor: coin.atrMoveFactor },
      onPrediction: () => haptic(15),
      onResolved: (r) => {
        haptic(50)
        const label =
          r.prediction.direction === 'up'
            ? 'yukarı'
            : r.prediction.direction === 'down'
              ? 'aşağı'
              : 'yatay'
        const move = `${r.movePct >= 0 ? '+' : ''}${r.movePct.toFixed(2)}%`
        if (r.kind === 'hit') toast.success(`Tahmin isabetli: ${label} · ${move}`)
        else if (r.kind === 'miss') toast.error(`Tahmin ıskaladı: ${label} · ${move}`)
        else toast.message(`Tahmin nötr sonuçlandı: ${label} · ${move}`)
      },
    })
    let lastClosedTime = 0
    const off = useMarketStore.subscribe((st, prev) => {
      if (st.candles === prev.candles) return
      const last = st.candles[st.candles.length - 1]
      if (!last || !last.closed || last.time === lastClosedTime) return
      lastClosedTime = last.time
      engine.handleClosedCandle(last)
    })
    return off
  }, [ready, symbol, timeframe])
}
