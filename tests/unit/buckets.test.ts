import { describe, expect, it } from 'vitest'
import {
  RECENT_MAX,
  bandFor,
  createBuckets,
  hitRate,
  pushRecent,
  recordBucketOutcome,
} from '@/shared/lib/buckets'

describe('bandFor', () => {
  it('sınırlar: ≥0.7 high, ≥0.4 medium, aksi low', () => {
    expect(bandFor(1)).toBe('high')
    expect(bandFor(0.7)).toBe('high')
    expect(bandFor(0.6999)).toBe('medium')
    expect(bandFor(0.4)).toBe('medium')
    expect(bandFor(0.0)).toBe('low')
  })
})

describe('recordBucketOutcome', () => {
  it("total/hit artar, streak hit'te büyür miss'te sıfırlanır", () => {
    let b = createBuckets()
    b = recordBucketOutcome(b, 'high', 'hit')
    b = recordBucketOutcome(b, 'high', 'hit')
    expect(b.high).toEqual({ band: 'high', total: 2, hits: 2, streak: 2 })
    b = recordBucketOutcome(b, 'high', 'miss')
    expect(b.high).toEqual({ band: 'high', total: 3, hits: 2, streak: 0 })
  })

  it('neutral ne hit sayılır ne streak kırar', () => {
    let b = createBuckets()
    b = recordBucketOutcome(b, 'low', 'hit')
    b = recordBucketOutcome(b, 'low', 'neutral')
    expect(b.low.total).toBe(2)
    expect(b.low.hits).toBe(1)
    expect(b.low.streak).toBe(0)
  })
})

describe('hitRate / pushRecent', () => {
  it('boş kova → 0', () => {
    expect(hitRate({ band: 'high', total: 0, hits: 0, streak: 0 })).toBe(0)
  })
  it('pushRecent en yeni önce, RECENT_MAX üst sınırı', () => {
    let recent = []
    for (let i = 0; i < RECENT_MAX + 10; i++) {
      recent = pushRecent(recent, {
        id: String(i),
        at: i,
        direction: 'up',
        confidence: 0.5,
        outcome: 'hit',
        movePct: 0.1,
      })
    }
    expect(recent).toHaveLength(RECENT_MAX)
    expect(recent[0].id).toBe(String(RECENT_MAX + 9))
  })
})
