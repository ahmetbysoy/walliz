import type {
  Bucket,
  ConfidenceBand,
  LearningStats,
  OutcomeKind,
  RecentValidation,
} from '@/entities'

/** Kova (pyramid bucket) mantığı — güven aralığına göre doğruluk takibi. */

export const BAND_ORDER: ConfidenceBand[] = ['high', 'medium', 'low']
export const RECENT_MAX = 30

export function bandFor(confidence: number): ConfidenceBand {
  if (confidence >= 0.7) return 'high'
  if (confidence >= 0.4) return 'medium'
  return 'low'
}

export function emptyBucket(band: ConfidenceBand): Bucket {
  return { band, total: 0, hits: 0, streak: 0 }
}

export function createBuckets(): Record<ConfidenceBand, Bucket> {
  return { high: emptyBucket('high'), medium: emptyBucket('medium'), low: emptyBucket('low') }
}

export function recordBucketOutcome(
  buckets: Record<ConfidenceBand, Bucket>,
  band: ConfidenceBand,
  kind: OutcomeKind,
): Record<ConfidenceBand, Bucket> {
  const b = buckets[band] ?? emptyBucket(band)
  const next: Bucket = {
    band,
    total: b.total + 1,
    hits: b.hits + (kind === 'hit' ? 1 : 0),
    streak: kind === 'hit' ? b.streak + 1 : 0,
  }
  return { ...buckets, [band]: next }
}

export function hitRate(bucket: Bucket): number {
  return bucket.total > 0 ? bucket.hits / bucket.total : 0
}

export function pushRecent(recent: RecentValidation[], item: RecentValidation): RecentValidation[] {
  return [item, ...recent].slice(0, RECENT_MAX)
}

export function zeroStats(): LearningStats {
  return { total: 0, hits: 0, misses: 0, neutrals: 0, streak: 0, bestStreak: 0, lastUpdatedAt: 0 }
}
