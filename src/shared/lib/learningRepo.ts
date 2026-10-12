import { z } from 'zod'
import type {
  FeatureVector,
  LearningState,
  Preferences,
  Prediction,
  RecentValidation,
  Weights,
} from '@/entities'
import { COINS, TIMEFRAMES } from '@/shared/config/coins'
import { RECENT_MAX, createBuckets, zeroStats } from './buckets'
import { isLegacyV1, migrateV1ToV2 } from './migrate'
import { WEIGHTS_VERSION, createInitialWeights, migrateWeights } from './model'
import { learningKey, preferencesKey, readJSON, writeJSON } from './idb'

/**
 * Öğrenme verisi + preferences deposu (IndexedDB).
 * - v1 localStorage verisi otomatik migrate edilir
 * - 90 günden eski `recent` kayıtları load/save'de elenir
 */

export const RECENT_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

export function createEmptyLearningState(): LearningState {
  return {
    weights: createInitialWeights(),
    stats: zeroStats(),
    recent: [],
    buckets: createBuckets(),
    pending: null,
  }
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0
}

function pruneRecent(recent: RecentValidation[], now: number): RecentValidation[] {
  return recent.filter((r) => now - r.at < RECENT_MAX_AGE_MS).slice(0, RECENT_MAX)
}

const zRecent = z.object({
  id: z.string(),
  at: z.number(),
  direction: z.enum(['up', 'down', 'flat']),
  confidence: z.number(),
  outcome: z.enum(['hit', 'miss', 'neutral']),
  movePct: z.number(),
})

/** Kayıtlı state'i güvenli hale getirir (bozuk alanlar default'a döner). */
export function sanitizeLearningState(raw: unknown): LearningState {
  const empty = createEmptyLearningState()
  if (typeof raw !== 'object' || raw === null) return empty
  const r = raw as Partial<LearningState>

  const weights = migrateWeights((r.weights as Weights | undefined) ?? null)

  const s = r.stats
  const stats = {
    ...zeroStats(),
    ...(typeof s === 'object' && s !== null
      ? {
          total: num(s.total),
          hits: num(s.hits),
          misses: num(s.misses),
          neutrals: num(s.neutrals),
          streak: num(s.streak),
          bestStreak: num(s.bestStreak),
          lastUpdatedAt: num(s.lastUpdatedAt),
        }
      : {}),
  }

  const recent: RecentValidation[] = []
  if (Array.isArray(r.recent)) {
    for (const item of r.recent.slice(0, RECENT_MAX)) {
      const p = zRecent.safeParse(item)
      if (p.success) recent.push(p.data)
    }
  }

  const buckets = { ...createBuckets() }
  for (const band of ['high', 'medium', 'low'] as const) {
    const b = (r.buckets as Record<string, unknown> | undefined)?.[band]
    if (b && typeof b === 'object') {
      buckets[band] = {
        band,
        total: num((b as { total?: unknown }).total),
        hits: num((b as { hits?: unknown }).hits),
        streak: num((b as { streak?: unknown }).streak),
      }
    }
  }

  const p = r.pending
  let pending: Prediction | null = null
  if (p && typeof p === 'object') {
    const cand = p as Prediction
    if (
      typeof cand.basePrice === 'number' &&
      cand.basePrice > 0 &&
      typeof cand.candleTime === 'number' &&
      cand.features &&
      typeof cand.features === 'object'
    ) {
      pending = {
        ...cand,
        features: { ...cand.features } as FeatureVector,
        direction: ['up', 'down', 'flat'].includes(cand.direction) ? cand.direction : 'flat',
        confidence: typeof cand.confidence === 'number' ? cand.confidence : 0,
        score: typeof cand.score === 'number' ? cand.score : 0,
        threshold: typeof cand.threshold === 'number' && cand.threshold > 0 ? cand.threshold : 1,
        id: typeof cand.id === 'string' ? cand.id : 'p-unknown',
        symbol: typeof cand.symbol === 'string' ? cand.symbol : '',
        timeframe: typeof cand.timeframe === 'string' ? cand.timeframe : '1m',
        at: typeof cand.at === 'number' ? cand.at : 0,
      }
    }
  }

  return { weights, stats, recent, buckets, pending }
}

export async function loadLearning(symbol: string, now = Date.now()): Promise<LearningState> {
  const raw = await readJSON<unknown>(learningKey(symbol))
  if (raw == null) return createEmptyLearningState()
  const state = isLegacyV1(raw) ? migrateV1ToV2(raw, now) : sanitizeLearningState(raw)
  return { ...state, recent: pruneRecent(state.recent, now) }
}

export async function saveLearning(symbol: string, state: LearningState): Promise<void> {
  const now = Date.now()
  await writeJSON(learningKey(symbol), { ...state, recent: pruneRecent(state.recent, now) })
}

export async function loadPreferences(): Promise<Preferences> {
  const raw = await readJSON<Partial<Preferences>>(preferencesKey)
  const symbol =
    raw?.symbol && COINS.some((c) => c.symbol === raw.symbol)
      ? (raw.symbol as string)
      : COINS[0].symbol
  const timeframe =
    raw?.timeframe && TIMEFRAMES.some((t) => t.id === raw.timeframe)
      ? (raw.timeframe as string)
      : TIMEFRAMES[0].id
  const base: Preferences = { symbol, timeframe, colorblind: raw?.colorblind === true }
  if (raw?.theme !== undefined) base.theme = raw.theme
  if (raw?.haptics !== undefined) base.haptics = raw.haptics
  if (raw?.favorites !== undefined) base.favorites = raw.favorites
  if (raw?.wallAlertThreshold !== undefined) base.wallAlertThreshold = raw.wallAlertThreshold
  if (raw?.hasSeenIntro !== undefined) base.hasSeenIntro = raw.hasSeenIntro
  return base
}

export async function savePreferences(p: Preferences): Promise<void> {
  await writeJSON(preferencesKey, p)
}

export { WEIGHTS_VERSION }
