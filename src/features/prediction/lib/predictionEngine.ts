import type {
  BookSnapshot,
  Candle,
  FeatureVector,
  LearningState,
  OutcomeKind,
  Prediction,
  RecentValidation,
  Wall,
} from '@/entities'
import { computeFeatures } from '@/shared/lib/features'
import { atr } from '@/shared/lib/math'
import { WEIGHTS_VERSION, learnWith, predictWith } from '@/shared/lib/model'
import { bandFor, pushRecent, recordBucketOutcome } from '@/shared/lib/buckets'

/**
 * Tahmin döngüsü orkestrasyonu (saf — yan etkiler callback'lerle dışarıda).
 * Kapalı mum gelince:
 *  1) bekleyen tahmin çözümlenir (hit/miss/neutral) → learn + istatistik + kova
 *  2) yeni tahmin üretilir → pending olarak persist
 */

export interface ResolvedOutcome {
  prediction: Prediction
  kind: OutcomeKind
  movePct: number
}

export interface PredictionEngineDeps {
  getCandleHistory: () => Candle[]
  getBook: () => BookSnapshot | null
  getWalls: () => Wall[]
  /** worker'ın son hesapladığı feature'lar (yoksa inline hesaplanır) */
  getFeatures: () => FeatureVector | null
  getLearning: () => LearningState
  updateLearning: (fn: (s: LearningState) => LearningState) => void
  coinConfig: { symbol: string; timeframe: string; atrMoveFactor: number }
  onPrediction: (p: Prediction) => void
  onResolved: (r: ResolvedOutcome) => void
}

let counter = 0
const nextId = (): string => `p-${Date.now().toString(36)}-${(counter++).toString(36)}`

export function createPredictionEngine(deps: PredictionEngineDeps) {
  return {
    handleClosedCandle(closed: Candle): void {
      const { symbol, timeframe, atrMoveFactor } = deps.coinConfig
      const learning = deps.getLearning()

      // 1) bekleyen tahmini çöz
      const pending = learning.pending
      if (pending && pending.candleTime < closed.time) {
        const move =
          pending.basePrice > 0 ? (closed.close - pending.basePrice) / pending.basePrice : 0
        const absThresholdPct = pending.threshold / pending.basePrice
        let kind: OutcomeKind
        if (Math.abs(move) < absThresholdPct * 0.25) {
          kind = 'neutral'
        } else if (pending.direction === 'up') {
          kind = move > 0 ? 'hit' : 'miss'
        } else if (pending.direction === 'down') {
          kind = move < 0 ? 'hit' : 'miss'
        } else {
          kind = 'neutral'
        }

        const moveAbs = closed.close - pending.basePrice
        const { values: newValues } = learnWith(
          learning.weights.values,
          pending.features,
          moveAbs,
          pending.threshold,
        )
        const band = bandFor(pending.confidence)

        const stats = { ...learning.stats }
        stats.total += 1
        if (kind === 'hit') {
          stats.hits += 1
          stats.streak += 1
          stats.bestStreak = Math.max(stats.bestStreak, stats.streak)
        } else if (kind === 'miss') {
          stats.misses += 1
          stats.streak = 0
        } else {
          stats.neutrals += 1
        }
        stats.lastUpdatedAt = Date.now()

        const item: RecentValidation = {
          id: pending.id,
          at: Date.now(),
          direction: pending.direction,
          confidence: pending.confidence,
          outcome: kind,
          movePct: move * 100,
        }

        deps.updateLearning((s) => ({
          ...s,
          weights: { version: WEIGHTS_VERSION, values: newValues },
          stats,
          recent: pushRecent(s.recent, item),
          buckets: recordBucketOutcome(s.buckets, band, kind),
          pending: null,
        }))
        deps.onResolved({ prediction: pending, kind, movePct: move * 100 })
      }

      // 2) yeni tahmin
      const candles = deps.getCandleHistory()
      const book = deps.getBook()
      if (candles.length < 25 || !book || book.bids.length === 0 || book.asks.length === 0) return
      const features =
        deps.getFeatures() ?? computeFeatures({ candles, book, walls: deps.getWalls() })
      if (!features) return
      const atrValue = atr(candles, 14)
      const last = candles[candles.length - 1]
      if (atrValue == null || atrValue <= 0 || !last) return

      const threshold = atrValue * atrMoveFactor
      const current = deps.getLearning()
      const { direction, confidence, score } = predictWith(current.weights.values, features)
      const prediction: Prediction = {
        id: nextId(),
        symbol,
        timeframe,
        at: Date.now(),
        candleTime: closed.time,
        basePrice: closed.close,
        direction,
        confidence,
        score,
        features,
        threshold,
      }
      deps.updateLearning((s) => ({ ...s, pending: prediction }))
      deps.onPrediction(prediction)
    },
  }
}
