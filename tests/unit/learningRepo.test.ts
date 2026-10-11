import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { set as idbSet } from 'idb-keyval'
import type { LearningState, Preferences } from '@/entities'
import {
  createEmptyLearningState,
  loadLearning,
  loadPreferences,
  saveLearning,
  savePreferences,
} from '@/shared/lib/learningRepo'
import { learningKey, preferencesKey } from '@/shared/lib/idb'

function sampleState(): LearningState {
  const s = createEmptyLearningState()
  s.stats = {
    ...s.stats,
    total: 3,
    hits: 2,
    misses: 1,
    neutrals: 0,
    streak: 1,
    bestStreak: 2,
    lastUpdatedAt: Date.now(),
  }
  s.pending = {
    id: 'p1',
    symbol: 'BTCUSDT',
    timeframe: '1m',
    at: Date.now(),
    candleTime: 1000,
    basePrice: 100,
    direction: 'up',
    confidence: 0.6,
    score: 0.6,
    features: { momentum: 0.5, imbalance: 0.2, wallPressure: 0.1, trend: 0.3, volatility: -0.2 },
    threshold: 0.5,
  }
  return s
}

beforeEach(async () => {
  await idbSet(learningKey('BTCUSDT'), '__reset__')
  await idbSet(preferencesKey, '__reset__')
})

describe('saveLearning / loadLearning', () => {
  it('round-trip: weights, stats ve pending korunur', async () => {
    const state = sampleState()
    await saveLearning('BTCUSDT', state)
    const loaded = await loadLearning('BTCUSDT')
    expect(loaded.stats.total).toBe(3)
    expect(loaded.stats.hits).toBe(2)
    expect(loaded.pending?.id).toBe('p1')
    expect(loaded.weights.version).toBe(state.weights.version)
  })

  it('boş sembol → default state', async () => {
    const loaded = await loadLearning('ETHUSDT')
    expect(loaded.stats.total).toBe(0)
    expect(loaded.pending).toBeNull()
  })

  it('90 günden eski recent kayıtları elenir', async () => {
    const state = sampleState()
    state.recent = [
      {
        id: 'old',
        at: Date.now() - 100 * 24 * 3600 * 1000,
        direction: 'up',
        confidence: 0.5,
        outcome: 'hit',
        movePct: 0.1,
      },
      {
        id: 'new',
        at: Date.now() - 2 * 24 * 3600 * 1000,
        direction: 'down',
        confidence: 0.5,
        outcome: 'miss',
        movePct: -0.1,
      },
    ]
    await saveLearning('BTCUSDT', state)
    const loaded = await loadLearning('BTCUSDT')
    expect(loaded.recent.map((r) => r.id)).toEqual(['new'])
  })

  it('bozuk JSON → default state (crash yok)', async () => {
    await idbSet(learningKey('SOLUSDT'), '{çöp json')
    const loaded = await loadLearning('SOLUSDT')
    expect(loaded.stats.total).toBe(0)
  })

  it('v1 verisi otomatik migrate edilir', async () => {
    await idbSet(
      learningKey('DOGEUSDT'),
      JSON.stringify({
        weights: [0.8, 0.2, 0.1, 0.4, -0.1],
        stats: { total: 4, correct: 3, streak: 2 },
      }),
    )
    const loaded = await loadLearning('DOGEUSDT')
    expect(loaded.weights.values.momentum).toBeCloseTo(0.8, 5)
    expect(loaded.stats.hits).toBe(3)
    expect(loaded.stats.misses).toBe(1)
  })
})

describe('preferences', () => {
  it('round-trip', async () => {
    const p: Preferences = { symbol: 'DOGEUSDT', timeframe: '5m', colorblind: true }
    await savePreferences(p)
    expect(await loadPreferences()).toEqual(p)
  })

  it('geçersiz sembol/timeframe → default', async () => {
    await savePreferences({ symbol: 'FAKECOIN', timeframe: '7w', colorblind: false })
    const p = await loadPreferences()
    expect(p.symbol).toBe('BTCUSDT')
    expect(p.timeframe).toBe('1m')
  })

  it('boş → default', async () => {
    const p = await loadPreferences()
    expect(p.symbol).toBe('BTCUSDT')
    expect(p.timeframe).toBe('1m')
    expect(p.colorblind).toBe(false)
  })
})
