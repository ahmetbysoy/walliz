import type { Direction, FeatureKey, FeatureVector, Weights } from '@/entities'
import { clamp, clamp01 } from './math'

/**
 * Online lineer model (MSE, sürekli hedef).
 * Matematik detayı: docs/MODEL.md
 */

export const WEIGHTS_VERSION = 1
export const FEATURE_KEYS: FeatureKey[] = [
  'momentum',
  'imbalance',
  'wallPressure',
  'trend',
  'volatility',
]

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  momentum: 'Momentum',
  imbalance: 'Kitap Dengesi',
  wallPressure: 'Duvar Basıncı',
  trend: 'Trend',
  volatility: 'Volatilite',
}

export const INITIAL_WEIGHT_VALUES: Record<FeatureKey, number> = {
  momentum: 0.5,
  imbalance: 0.4,
  wallPressure: 0.35,
  trend: 0.45,
  volatility: -0.1,
}

const LR = 0.08
const DECAY = 0.0005
const WEIGHT_CLAMP = 2
const DECISION_EPS = 0.15

export function createInitialWeights(): Weights {
  return { version: WEIGHTS_VERSION, values: { ...INITIAL_WEIGHT_VALUES } }
}

export function scoreWith(values: Record<FeatureKey, number>, f: FeatureVector): number {
  let s = 0
  for (const k of FEATURE_KEYS) s += values[k] * f[k]
  return s
}

export interface ModelPrediction {
  direction: Direction
  confidence: number
  score: number
}

export function predictWith(values: Record<FeatureKey, number>, f: FeatureVector): ModelPrediction {
  const score = scoreWith(values, f)
  const direction: Direction = score > DECISION_EPS ? 'up' : score < -DECISION_EPS ? 'down' : 'flat'
  const confidence = clamp01(Math.abs(score))
  return { direction, confidence, score }
}

/** Sürekli regresyon hedefi: target = sign(move) * min(1, |move| / threshold) */
export function regressionTarget(actualMove: number, threshold: number): number {
  if (!Number.isFinite(actualMove) || !Number.isFinite(threshold) || threshold <= 0) return 0
  const sign = actualMove > 0 ? 1 : actualMove < 0 ? -1 : 0
  return sign * clamp01(Math.abs(actualMove) / threshold)
}

export function learnWith(
  values: Record<FeatureKey, number>,
  f: FeatureVector,
  actualMove: number,
  threshold: number,
): { values: Record<FeatureKey, number>; target: number; error: number } {
  const target = regressionTarget(actualMove, threshold)
  const error = target - scoreWith(values, f)
  const next: Record<FeatureKey, number> = { ...values }
  for (const k of FEATURE_KEYS) {
    next[k] = clamp(next[k] + LR * error * f[k] - DECAY * next[k], -WEIGHT_CLAMP, WEIGHT_CLAMP)
  }
  return { values: next, target, error }
}

/** Versiyon uyuşmazlığında ağırlıklar sıfırlanır (istatistikler repo tarafında korunur). */
export function migrateWeights(old: Weights | null | undefined): Weights {
  if (!old || old.version !== WEIGHTS_VERSION || !old.values) return createInitialWeights()
  const values: Record<FeatureKey, number> = { ...INITIAL_WEIGHT_VALUES }
  for (const k of FEATURE_KEYS) {
    const v = old.values[k]
    if (typeof v === 'number' && Number.isFinite(v))
      values[k] = clamp(v, -WEIGHT_CLAMP, WEIGHT_CLAMP)
  }
  return { version: WEIGHTS_VERSION, values }
}

/** Spec API'si: class sarmalayıcı (saf fonksiyonların state'li hâli). */
export class PredictionModel {
  private weights: Weights

  constructor(weights?: Weights) {
    this.weights = weights ?? createInitialWeights()
  }

  get currentWeights(): Weights {
    return this.weights
  }

  predict(f: FeatureVector): ModelPrediction {
    return predictWith(this.weights.values, f)
  }

  learn(f: FeatureVector, actualMove: number, threshold: number): Weights {
    const { values } = learnWith(this.weights.values, f, actualMove, threshold)
    this.weights = { version: this.weights.version, values }
    return this.weights
  }

  reset(): Weights {
    this.weights = createInitialWeights()
    return this.weights
  }
}
