import { useEffect } from 'react'
import { toast } from 'sonner'
import {
  MIN_CANDLES_FOR_PREDICTION,
  createPredictionEngine,
} from '@/features/prediction/lib/predictionEngine'
import { getCoin } from '@/shared/config/coins'
import { haptic } from '@/shared/lib/haptics'
import { useMarketStore } from '@/shared/model/marketStore'
import { useLearningStore } from '@/shared/model/learningStore'

/** Aynı kapalı mum için en fazla kaç kez deneme yapılır (boşa hesabı sınırlar) */
const MAX_ATTEMPTS_PER_CANDLE = 3

/**
 * Tahmin döngüsü: kapalı mum → çözümlenme + yeni tahmin (haptic + toast).
 *
 * Motor, öğrenme verisi **diskten yüklendikten sonra** kurulur: böylece yükleme
 * sürerken üretilen tahmin/çözümler diskteki eski kayıtla çakışmaz ve önceki
 * sembolün ağırlıkları yeni sembolde kullanılmaz.
 *
 * Gerçek feed'de veriler farklı zamanlarda gelir: REST geçmişi (mumlar) ile canlı
 * derinlik (kitap) aynı anda hazır olmayabilir. Bu yüzden kapalı mum, ön koşullar
 * (yeterli mum + kitap) sağlanana kadar "bekleyen mum" olarak tutulur ve veri
 * geldiğinde yeniden denenir — mum sessizce atlanmaz.
 */
export function usePrediction(ready: boolean) {
  const symbol = useMarketStore((s) => s.symbol)
  const timeframe = useMarketStore((s) => s.timeframe)
  const learningReady = useLearningStore((s) => s.loaded && s.symbol === symbol)

  useEffect(() => {
    if (!ready || !learningReady) return
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

    let handledTime = 0
    let attempts = 0

    const attempt = (): void => {
      const st = useMarketStore.getState()
      const last = st.candles[st.candles.length - 1]
      if (!last || !last.closed) return
      if (last.time <= handledTime) return
      // ön koşullar hazır değilse "bekleyen mum" olarak kalır; veri gelince denenir
      const bookReady = st.book !== null && st.book.bids.length > 0 && st.book.asks.length > 0
      if (st.candles.length < MIN_CANDLES_FOR_PREDICTION || !bookReady) return
      if (last.time !== handledTime) attempts = 0
      attempts += 1
      const produced = engine.handleClosedCandle(last)
      if (produced || attempts >= MAX_ATTEMPTS_PER_CANDLE) {
        handledTime = last.time
        attempts = 0
      }
    }

    // ilk değerlendirme: sayfa açılışında zaten kapanmış bir mum olabilir
    attempt()
    const off = useMarketStore.subscribe((st, prev) => {
      if (st.candles === prev.candles && st.book === prev.book && st.features === prev.features) {
        return
      }
      attempt()
    })
    return off
  }, [ready, learningReady, symbol, timeframe])
}
