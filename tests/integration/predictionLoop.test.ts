import { describe, expect, it } from 'vitest'
import type { BookSnapshot, Candle, FeatureVector, Prediction } from '@/entities'
import {
  createPredictionEngine,
  type ResolvedOutcome,
} from '@/features/prediction/lib/predictionEngine'
import { createEmptyLearningState } from '@/shared/lib/learningRepo'
import { INITIAL_WEIGHT_VALUES } from '@/shared/lib/model'

function candles(n: number, start = 0, close = 100): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    time: (start + i) * 60,
    open: close,
    high: close + 0.1,
    low: close - 0.1,
    close,
    volume: 1,
    closed: true,
  }))
}

function book(): BookSnapshot {
  const mk = (side: 'bid' | 'ask') =>
    Array.from({ length: 10 }, (_, i) => ({
      price: side === 'bid' ? 100 - (i + 1) * 0.1 : 100 + (i + 1) * 0.1,
      qty: 10,
      total: (i + 1) * 10,
    }))
  return { bids: mk('bid'), asks: mk('ask'), ts: 0 }
}

const FEATURES: FeatureVector = {
  momentum: 0.9,
  imbalance: 0.8,
  wallPressure: 0.7,
  trend: 0.8,
  volatility: -0.5,
}

describe('prediction loop (kapalı mum → tahmin → çözüm → öğrenme)', () => {
  function setup() {
    let learning = createEmptyLearningState()
    const predictions: Prediction[] = []
    const resolved: ResolvedOutcome[] = []
    const candleList = candles(40)
    const engine = createPredictionEngine({
      getCandleHistory: () => candleList,
      getBook: () => book(),
      getWalls: () => [],
      getFeatures: () => FEATURES,
      getLearning: () => learning,
      updateLearning: (fn) => {
        learning = fn(learning)
      },
      coinConfig: { symbol: 'BTCUSDT', timeframe: '1m', atrMoveFactor: 0.35 },
      onPrediction: (p) => predictions.push(p),
      onResolved: (r) => resolved.push(r),
    })
    return {
      engine,
      predictions,
      resolved,
      candleList,
      get learning() {
        return learning
      },
    }
  }

  it('kapalı mumda güçlü feature → up tahmini (pending)', () => {
    const { engine, predictions, candleList } = setup()
    engine.handleClosedCandle(candleList[39])
    expect(predictions).toHaveLength(1)
    const p = predictions[0]
    expect(p.direction).toBe('up')
    expect(p.confidence).toBe(1)
    expect(p.basePrice).toBe(100)
    expect(p.threshold).toBeGreaterThan(0)
    expect(p.candleTime).toBe(candleList[39].time)
  })

  it('sonraki mum +2% → hit, ağırlıklar güncellenir, kova dolar, pending sıfırlanır', () => {
    const ctx = setup()
    ctx.engine.handleClosedCandle(ctx.candleList[39])
    expect(ctx.learning.pending).not.toBeNull()

    const next = { ...ctx.candleList[39], time: ctx.candleList[39].time + 60, close: 102 }
    ctx.engine.handleClosedCandle(next)

    expect(ctx.resolved).toHaveLength(1)
    expect(ctx.resolved[0].kind).toBe('hit')
    expect(ctx.resolved[0].movePct).toBeCloseTo(2, 5)
    // eski pending çözüldü; yerine yeni pending üretildi
    expect(ctx.learning.pending?.id).not.toBe(ctx.resolved[0].prediction.id)
    expect(ctx.learning.pending?.basePrice).toBe(102)
    expect(ctx.learning.stats.total).toBe(1)
    expect(ctx.learning.stats.hits).toBe(1)
    expect(ctx.learning.stats.streak).toBe(1)
    // confidence=1 → high kova
    expect(ctx.learning.buckets.high.total).toBe(1)
    expect(ctx.learning.buckets.high.hits).toBe(1)
    // learn: skor 1.425 > hedef 1 → momentum ağırlığı düşer
    expect(ctx.learning.weights.values.momentum).toBeLessThan(INITIAL_WEIGHT_VALUES.momentum)
    expect(ctx.learning.recent).toHaveLength(1)
    expect(ctx.learning.recent[0].outcome).toBe('hit')
    // yeni tahmin üretildi (basePrice = 102)
    expect(ctx.predictions).toHaveLength(2)
    expect(ctx.predictions[1].basePrice).toBe(102)
  })

  it('flat yön nötr sonuçlanır; -2% → up tahmini için miss', () => {
    const ctx = setup()
    ctx.engine.handleClosedCandle(ctx.candleList[39])
    const down = { ...ctx.candleList[39], time: ctx.candleList[39].time + 60, close: 98 }
    ctx.engine.handleClosedCandle(down)
    expect(ctx.resolved[0].kind).toBe('miss')
  })

  it('küçük hareket → neutral (eşiğin 1/4 oranının altında)', () => {
    const ctx = setup()
    ctx.engine.handleClosedCandle(ctx.candleList[39])
    const thresholdPct = (ctx.learning.pending?.threshold ?? 0) / 100
    const tiny = 100 * (1 + thresholdPct * 0.1) // çok küçük hareket
    ctx.engine.handleClosedCandle({
      ...ctx.candleList[39],
      time: ctx.candleList[39].time + 60,
      close: tiny,
    })
    expect(ctx.resolved[0].kind).toBe('neutral')
    expect(ctx.learning.stats.neutrals).toBe(1)
  })

  it('ön koşul eksikse false döner (çağıran taraf bekleyen mumu yeniden deneyebilir)', () => {
    const learning = createEmptyLearningState()
    const engine = createPredictionEngine({
      getCandleHistory: () => candles(40),
      getBook: () => null, // kitap henüz gelmedi
      getWalls: () => [],
      getFeatures: () => null,
      getLearning: () => learning,
      updateLearning: () => {},
      coinConfig: { symbol: 'BTCUSDT', timeframe: '1m', atrMoveFactor: 0.35 },
      onPrediction: () => {},
      onResolved: () => {},
    })
    expect(engine.handleClosedCandle(candles(40)[39])).toBe(false)
  })

  it('tahmin üretildiğinde true döner', () => {
    const ctx = setup()
    expect(ctx.engine.handleClosedCandle(ctx.candleList[39])).toBe(true)
  })

  it('yetersiz mumda tahmin üretmez', () => {
    const learning = createEmptyLearningState()
    const predictions: Prediction[] = []
    const engine = createPredictionEngine({
      getCandleHistory: () => candles(10),
      getBook: () => book(),
      getWalls: () => [],
      getFeatures: () => FEATURES,
      getLearning: () => learning,
      updateLearning: () => {},
      coinConfig: { symbol: 'BTCUSDT', timeframe: '1m', atrMoveFactor: 0.35 },
      onPrediction: (p) => predictions.push(p),
      onResolved: () => {},
    })
    engine.handleClosedCandle(candles(10)[9])
    expect(predictions).toHaveLength(0)
    expect(learning.pending).toBeNull()
  })
})
