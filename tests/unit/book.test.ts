import { describe, expect, it } from 'vitest'
import { buildBookSnapshot, normalizeBookRows, type RawRow } from '@/shared/lib/book'

describe('normalizeBookRows', () => {
  it('bids: azalan sıralama + kümülatif derinlik', () => {
    const rows: RawRow[] = [
      ['99.5', '1'],
      ['100', '5'],
      ['99.5', '2'],
    ]
    const levels = normalizeBookRows(rows, 'bid')
    expect(levels).toHaveLength(2)
    expect(levels[0]).toEqual({ price: 100, qty: 5, total: 5 })
    expect(levels[1]).toEqual({ price: 99.5, qty: 3, total: 8 })
  })

  it('asks: artan sıralama', () => {
    const rows: RawRow[] = [
      ['101', '2'],
      ['100.5', '1'],
    ]
    const levels = normalizeBookRows(rows, 'ask')
    expect(levels.map((l) => l.price)).toEqual([100.5, 101])
    expect(levels[1].total).toBe(3)
  })

  it('geçersiz satırları atar (NaN, ≤0)', () => {
    const rows: RawRow[] = [
      ['abc', '1'],
      ['100', '0'],
      ['99', '-1'],
      ['101', 'xyz'],
      ['102', '4'],
    ]
    const levels = normalizeBookRows(rows, 'bid')
    expect(levels).toHaveLength(1)
    expect(levels[0].price).toBe(102)
  })

  it('boş girdi → []', () => {
    expect(normalizeBookRows([], 'bid')).toEqual([])
  })

  it('string aritmetiği (float hatası koruması)', () => {
    const rows: RawRow[] = [
      ['0.1', '0.2'],
      ['0.1', '0.3'],
    ]
    const levels = normalizeBookRows(rows, 'bid')
    expect(levels[0].qty).toBeCloseTo(0.5, 10)
  })
})

describe('buildBookSnapshot', () => {
  it('ts + lastUpdateId taşır', () => {
    const snap = buildBookSnapshot([['100', '1']], [['101', '1']], 1234, 42)
    expect(snap.ts).toBe(1234)
    expect(snap.lastUpdateId).toBe(42)
    expect(snap.bids[0].price).toBe(100)
    expect(snap.asks[0].price).toBe(101)
  })
})
