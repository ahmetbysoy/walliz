import { z } from 'zod'
import type { LearningState, RecentValidation, Weights } from '@/entities'
import { FEATURE_KEYS, WEIGHTS_VERSION, createInitialWeights } from './model'
import { createBuckets, zeroStats } from './buckets'

/**
 * v1 (eski tek-dosya vanilla sürüm) → v2 migrasyonu.
 * v1 şekli: { weights: number[] | Record<string, number>, stats: { total, correct, streak }, recent: any[] }
 */

const zV1Weights = z.union([z.array(z.number()), z.record(z.string(), z.number())])

const zV1RecentItem = z
  .object({
    at: z.number(),
    direction: z.string(),
    confidence: z.number(),
    outcome: z.string(),
    movePct: z.number(),
  })
  .passthrough()

const zV1 = z.object({
  weights: zV1Weights,
  stats: z
    .object({
      total: z.number(),
      correct: z.number(),
      streak: z.number(),
      bestStreak: z.number().optional(),
    })
    .partial()
    .default({}),
  recent: z.array(zV1RecentItem).optional(),
})

export function isLegacyV1(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null) return false
  const r = raw as Record<string, unknown>
  return 'weights' in r && !('buckets' in r)
}

export function migrateV1ToV2(raw: unknown, now = Date.now()): LearningState {
  const parsed = zV1.safeParse(raw)
  const weights: Weights = createInitialWeights()

  if (parsed.success) {
    const w = parsed.data.weights
    if (Array.isArray(w)) {
      FEATURE_KEYS.forEach((k, i) => {
        if (Number.isFinite(w[i])) weights.values[k] = w[i]
      })
    } else {
      for (const k of FEATURE_KEYS) {
        const v = w[k]
        if (typeof v === 'number' && Number.isFinite(v)) weights.values[k] = v
      }
    }
  }

  const total = parsed.success ? (parsed.data.stats.total ?? 0) : 0
  const hits = parsed.success ? (parsed.data.stats.correct ?? 0) : 0
  const streak = parsed.success ? (parsed.data.stats.streak ?? 0) : 0
  const stats = {
    ...zeroStats(),
    total,
    hits,
    misses: Math.max(0, total - hits),
    streak,
    bestStreak: parsed.success ? (parsed.data.stats.bestStreak ?? streak) : 0,
    lastUpdatedAt: now,
  }

  const recent: RecentValidation[] = (parsed.success ? (parsed.data.recent ?? []) : [])
    .filter((r) => ['hit', 'miss', 'neutral'].includes(r.outcome))
    .slice(0, 30)
    .map((r, i) => ({
      id: `v1-${i}`,
      at: r.at,
      direction: (['up', 'down', 'flat'].includes(r.direction)
        ? r.direction
        : 'flat') as RecentValidation['direction'],
      confidence: Number.isFinite(r.confidence) ? r.confidence : 0,
      outcome: r.outcome as RecentValidation['outcome'],
      movePct: r.movePct,
    }))

  return {
    weights: { version: WEIGHTS_VERSION, values: { ...weights.values } },
    stats,
    recent,
    buckets: createBuckets(),
    pending: null,
  }
}
