import { describe, expect, it } from 'vitest'
import { isLegacyV1, migrateV1ToV2 } from '@/shared/lib/migrate'
import { WEIGHTS_VERSION } from '@/shared/lib/model'
import { sanitizeLearningState } from '@/shared/lib/learningRepo'

const V1 = {
  weights: [0.7, 0.3, 0.2, 0.5, -0.05],
  stats: { total: 10, correct: 7, streak: 2 },
  recent: [
    { at: 1000, direction: 'up', confidence: 0.8, outcome: 'hit', movePct: 0.3 },
    { at: 2000, direction: 'x', confidence: 0.5, outcome: 'maybe', movePct: 0.1 },
    { at: 3000, direction: 'down', confidence: 0.6, outcome: 'miss', movePct: -0.4 },
  ],
}

describe('isLegacyV1', () => {
  it('weights var, buckets yok → v1', () => {
    expect(isLegacyV1(V1)).toBe(true)
  })
  it('buckets varsa v1 değil', () => {
    expect(isLegacyV1({ weights: {}, buckets: {} })).toBe(false)
  })
  it('boş/null → false', () => {
    expect(isLegacyV1(null)).toBe(false)
    expect(isLegacyV1('x')).toBe(false)
    expect(isLegacyV1({})).toBe(false)
  })
})

describe('migrateV1ToV2', () => {
  it('ağırlık array → feature key map', () => {
    const s = migrateV1ToV2(V1)
    expect(s.weights.version).toBe(WEIGHTS_VERSION)
    expect(s.weights.values.momentum).toBeCloseTo(0.7, 5)
    expect(s.weights.values.imbalance).toBeCloseTo(0.3, 5)
    expect(s.weights.values.wallPressure).toBeCloseTo(0.2, 5)
    expect(s.weights.values.trend).toBeCloseTo(0.5, 5)
    expect(s.weights.values.volatility).toBeCloseTo(-0.05, 5)
  })

  it('istatistikler taşınır: correct → hits, misses türetilir', () => {
    const s = migrateV1ToV2(V1)
    expect(s.stats.total).toBe(10)
    expect(s.stats.hits).toBe(7)
    expect(s.stats.misses).toBe(3)
    expect(s.stats.streak).toBe(2)
    expect(s.stats.bestStreak).toBe(2)
  })

  it('geçersiz recent kayıtları elenir', () => {
    const s = migrateV1ToV2(V1)
    expect(s.recent).toHaveLength(2)
    expect(s.recent.map((r) => r.direction)).toEqual(['up', 'down'])
  })

  it('record ağırlık formatı da desteklenir', () => {
    const s = migrateV1ToV2({
      weights: { momentum: 0.9 },
      stats: { total: 1, correct: 1, streak: 1 },
    })
    expect(s.weights.values.momentum).toBeCloseTo(0.9, 5)
  })

  it('çöp girdi → default state (crash yok)', () => {
    const s = migrateV1ToV2('gerekli-degil')
    expect(s.stats.total).toBe(0)
    expect(s.pending).toBeNull()
    expect(s.buckets.high.total).toBe(0)
  })
})

describe('sanitizeLearningState', () => {
  it('geçerli state korunur', () => {
    const state = {
      weights: {
        version: WEIGHTS_VERSION,
        values: { momentum: 0.9, imbalance: 0.1, wallPressure: 0.2, trend: 0.3, volatility: -0.4 },
      },
      stats: {
        total: 5,
        hits: 2,
        misses: 2,
        neutrals: 1,
        streak: 1,
        bestStreak: 3,
        lastUpdatedAt: 1,
      },
      recent: [{ id: 'a', at: 1, direction: 'up', confidence: 0.5, outcome: 'hit', movePct: 0.2 }],
      buckets: {
        high: { band: 'high', total: 1, hits: 1, streak: 1 },
        medium: { band: 'medium', total: 0, hits: 0, streak: 0 },
        low: { band: 'low', total: 0, hits: 0, streak: 0 },
      },
      pending: null,
    }
    const s = sanitizeLearningState(state)
    expect(s.stats.total).toBe(5)
    expect(s.weights.values.momentum).toBeCloseTo(0.9, 5)
    expect(s.recent).toHaveLength(1)
    expect(s.buckets.high.total).toBe(1)
  })

  it('bozuk state → güvenli default', () => {
    const s = sanitizeLearningState({ weights: 'çöp', stats: { total: 'x' }, recent: [{ id: 1 }] })
    expect(s.stats.total).toBe(0)
    expect(s.weights.values.momentum).toBeGreaterThan(0)
    expect(s.recent).toEqual([])
    expect(s.pending).toBeNull()
  })
})
