import { describe, expect, it } from 'vitest'
import {
  formatCompact,
  formatPct,
  formatPrice,
  formatQty,
  formatTime,
  isUsableNumber,
} from '@/shared/lib/format'

describe('isUsableNumber', () => {
  it('NaN/Infinity reddeder', () => {
    expect(isUsableNumber(Number.NaN)).toBe(false)
    expect(isUsableNumber(Infinity)).toBe(false)
    expect(isUsableNumber('5' as unknown as number)).toBe(false)
    expect(isUsableNumber(3.14)).toBe(true)
  })
})

describe('formatPrice', () => {
  it('NaN → —', () => expect(formatPrice(Number.NaN)).toBe('—'))
  it('0 → 0.00', () => expect(formatPrice(0)).toBe('0.00'))
  it('açık desimal', () => expect(formatPrice(67432.123, 2)).toBe('67,432.12'))
  it('küçük coin (DOGE)', () => expect(formatPrice(0.16245, 5)).toBe('0.16245'))
  it('büyük sayı', () => expect(formatPrice(1234567.891, 2)).toBe('1,234,567.89'))
})

describe('formatCompact', () => {
  it('K/M/B sınırları', () => {
    expect(formatCompact(1500)).toBe('1,500')
    expect(formatCompact(15000)).toBe('15K')
    expect(formatCompact(1234567)).toBe('1.23M')
    expect(formatCompact(2_500_000_000)).toBe('2.5B')
  })
  it('NaN → —', () => expect(formatCompact(Number.NaN)).toBe('—'))
  it('0 → 0', () => expect(formatCompact(0)).toBe('0'))
})

describe('formatPct', () => {
  it('pozitif işaretli', () => expect(formatPct(1.234)).toBe('+1.23%'))
  it('negatif', () => expect(formatPct(-0.5)).toBe('-0.50%'))
  it('sıfır', () => expect(formatPct(0)).toBe('0.00%'))
  it('NaN → —', () => expect(formatPct(Number.NaN)).toBe('—'))
})

describe('formatQty / formatTime', () => {
  it('qty: büyük sayılar kısa', () => {
    expect(formatQty(1234)).toBe('1,234')
    expect(formatQty(0.0012)).toBe('0.0012')
    expect(formatQty(Number.NaN)).toBe('—')
  })
  it('time: HH:MM:SS', () => {
    const ts = new Date('2026-10-11T15:04:05Z').getTime()
    expect(formatTime(ts)).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(formatTime(Number.NaN)).toBe('—')
  })
})
