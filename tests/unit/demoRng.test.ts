import { describe, expect, it } from 'vitest'
import { chance, gaussian, mulberry32, pick, rangeInt } from '@/features/market-feed/lib/demoRng'

describe('mulberry32', () => {
  it('aynı seed → aynı dizi (deterministik)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 100; i++) expect(a()).toBe(b())
  })

  it('farklı seed → farklı dizi', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('[0, 1) aralığında', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 1000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('gaussian / rangeInt / pick / chance', () => {
  it('gaussian ortalaması ~0 (10k örnekle)', () => {
    const r = mulberry32(123)
    let sum = 0
    const n = 10_000
    for (let i = 0; i < n; i++) sum += gaussian(r)
    expect(Math.abs(sum / n)).toBeLessThan(0.05)
  })

  it('rangeInt dahil sınırlı', () => {
    const r = mulberry32(5)
    for (let i = 0; i < 500; i++) {
      const v = rangeInt(r, 2, 7)
      expect(v).toBeGreaterThanOrEqual(2)
      expect(v).toBeLessThanOrEqual(7)
    }
  })

  it('pick her zaman listeden döner', () => {
    const r = mulberry32(9)
    for (let i = 0; i < 100; i++) {
      expect(['bid', 'ask']).toContain(pick(r, ['bid', 'ask']))
    }
  })

  it('chance yaklaşık olasılık', () => {
    const r = mulberry32(11)
    let hits = 0
    const n = 10_000
    for (let i = 0; i < n; i++) if (chance(r, 0.3)) hits++
    expect(hits / n).toBeGreaterThan(0.25)
    expect(hits / n).toBeLessThan(0.35)
  })
})
