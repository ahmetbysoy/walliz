/** Öğrenme modeli tipleri (saf tipler). */

export interface FeatureVector {
  momentum: number
  imbalance: number
  wallPressure: number
  trend: number
  volatility: number
}

export type FeatureKey = keyof FeatureVector

export type Direction = 'up' | 'down' | 'flat'

export interface Prediction {
  id: string
  symbol: string
  timeframe: string
  at: number
  /** Tahminin üretildiği kapanan mumun zamanı (unix saniye) */
  candleTime: number
  /** Referans fiyat (o mumun close'u) */
  basePrice: number
  direction: Direction
  /** 0..1 */
  confidence: number
  /** Ham skor */
  score: number
  features: FeatureVector
  /** Fiyat biriminde anlamlılık eşiği (atrMoveFactor * ATR) */
  threshold: number
}

export type OutcomeKind = 'hit' | 'miss' | 'neutral'

export interface RecentValidation {
  id: string
  at: number
  direction: Direction
  confidence: number
  outcome: OutcomeKind
  movePct: number
}

export interface Weights {
  version: number
  values: Record<FeatureKey, number>
}

export interface LearningStats {
  total: number
  hits: number
  misses: number
  neutrals: number
  streak: number
  bestStreak: number
  lastUpdatedAt: number
}

export type ConfidenceBand = 'low' | 'medium' | 'high'

export interface Bucket {
  band: ConfidenceBand
  total: number
  hits: number
  streak: number
}

export interface LearningState {
  weights: Weights
  stats: LearningStats
  recent: RecentValidation[]
  buckets: Record<ConfidenceBand, Bucket>
  /** Sayfa yenilense bile bir sonraki mumda çözülür */
  pending: Prediction | null
}

export interface Preferences {
  symbol: string
  timeframe: string
  colorblind: boolean
  theme?: 'dark' | 'light'
  haptics?: boolean
  favorites?: string[]
  wallAlertThreshold?: number
  hasSeenIntro?: boolean
}
