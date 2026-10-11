import { describe, expect, it } from 'vitest'
import type { FeatureVector } from '@/entities'
import {
  FEATURE_KEYS,
  INITIAL_WEIGHT_VALUES,
  PredictionModel,
  WEIGHTS_VERSION,
  createInitialWeights,
  learnWith,
  migrateWeights,
  predictWith,
  regressionTarget,
  scoreWith,
} from '@/shared/lib/model'

const F = (v: number): FeatureVector => ({
  momentum: v,
  imbalance: v,
  wallPressure: v,
  trend: v,
  volatility: v,
})

describe('predictWith', () => {
  it('güçlü pozitif feature → up, confidence ~1', () => {
    const r = predictWith(createInitialWeights().values, F(0.8))
    expect(r.direction).toBe('up')
    expect(r.confidence).toBe(1)
    expect(r.score).toBeGreaterThan(1)
  })

  it('güçlü negatif → down', () => {
    expect(predictWith(createInitialWeights().values, F(-0.8)).direction).toBe('down')
  })

  it('zayıf sinyal → flat', () => {
    const r = predictWith(createInitialWeights().values, F(0.05))
    expect(r.direction).toBe('flat')
    expect(r.confidence).toBeLessThan(0.2)
  })
})

describe('regressionTarget', () => {
  it('sürekli hedef: sign * min(1, |move|/threshold)', () => {
    expect(regressionTarget(0.5, 0.5)).toBe(1)
    expect(regressionTarget(-0.25, 0.5)).toBeCloseTo(-0.5, 5)
    expect(regressionTarget(2, 0.5)).toBe(1)
    expect(regressionTarget(0, 0.5)).toBe(0)
    expect(regressionTarget(0.3, 0)).toBe(0)
    expect(regressionTarget(Number.NaN, 1)).toBe(0)
  })
})

describe('learnWith', () => {
  it('hedef skorun üstünde → ağırlıklar küçülür (aşırı özgüven düzeltmesi)', () => {
    const before = scoreWith(INITIAL_WEIGHT_VALUES, F(1)) // 1.6
    const { values, target, error } = learnWith({ ...INITIAL_WEIGHT_VALUES }, F(1), 1, 1)
    expect(target).toBe(1)
    expect(error).toBeCloseTo(1 - before, 5)
    expect(scoreWith(values, F(1))).toBeLessThan(before)
    expect(values.momentum).toBeLessThan(INITIAL_WEIGHT_VALUES.momentum)
  })

  it('hedef skorun altında → ağırlıklar büyür', () => {
    const f = F(0.2) // skor 0.32
    const { values } = learnWith({ ...INITIAL_WEIGHT_VALUES }, f, 1, 1)
    expect(values.momentum).toBeGreaterThan(INITIAL_WEIGHT_VALUES.momentum)
  })

  it('ağırlıklar [-2, 2] clamp içinde kalır', () => {
    let values = { ...INITIAL_WEIGHT_VALUES }
    for (let i = 0; i < 2000; i++) {
      ;({ values } = learnWith(values, F(1), 10, 1))
    }
    for (const k of FEATURE_KEYS) {
      expect(values[k]).toBeGreaterThanOrEqual(-2)
      expect(values[k]).toBeLessThanOrEqual(2)
    }
  })
})

describe('migrateWeights', () => {
  it('null / yanlış versiyon → başlangıç ağırlıkları', () => {
    expect(migrateWeights(null)).toEqual(createInitialWeights())
    expect(migrateWeights({ version: 999, values: { ...INITIAL_WEIGHT_VALUES } })).toEqual(
      createInitialWeights(),
    )
  })

  it('doğru versiyon: değerler korunur, bozuk alanlar default', () => {
    const old = {
      version: WEIGHTS_VERSION,
      values: { ...INITIAL_WEIGHT_VALUES, momentum: 0.9, volatility: Number.NaN },
    }
    const m = migrateWeights(old as never)
    expect(m.values.momentum).toBe(0.9)
    expect(m.values.volatility).toBe(INITIAL_WEIGHT_VALUES.volatility)
    expect(m.version).toBe(WEIGHTS_VERSION)
  })
})

describe('PredictionModel (class API)', () => {
  it('predict → learn → weights güncellenir → reset', () => {
    const model = new PredictionModel()
    const f = F(0.8)
    const p1 = model.predict(f)
    expect(p1.direction).toBe('up')
    const w = model.learn(f, 0.5, 0.5)
    expect(w.values.momentum).toBeLessThan(INITIAL_WEIGHT_VALUES.momentum)
    expect(model.currentWeights).toBe(w)
    model.reset()
    expect(model.currentWeights.values).toEqual(INITIAL_WEIGHT_VALUES)
  })
})
