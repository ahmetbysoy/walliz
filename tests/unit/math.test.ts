import { describe, expect, it } from 'vitest'
import { atr, clamp, clamp01, ema, hashSeed, median, tanhScale } from '@/shared/lib/math'

describe('median', () => {
  it('tek/çift/boş', () => {
    expect(median([1, 3, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([])).toBe(0)
  })
})

describe('clamp', () => {
  it('sınırlara oturtur', () => {
    expect(clamp(5, 0, 1)).toBe(1)
    expect(clamp(-5, 0, 1)).toBe(0)
    expect(clamp(0.5, 0, 1)).toBe(0.5)
    expect(clamp01(2)).toBe(1)
  })
})

describe('atr', () => {
  it('düz mumda ~0', () => {
    const candles = Array.from({ length: 20 }, (_, i) => ({
      high: 100,
      low: 100,
      close: 100,
      time: i,
    }))
    expect(atr(candles, 14)).toBe(0)
  })
  it('bilinen TR serisinde ortalama', () => {
    const candles = Array.from({ length: 20 }, (_, i) => ({
      high: 100 + i + 1,
      low: 100 + i - 1,
      close: 100 + i,
    }))
    // her mumda TR = 2 (high-low), gap'lere bakmaksızın en büyük 2
    expect(atr(candles, 14)).toBeCloseTo(2, 5)
  })
  it('yetersiz mumda null', () => {
    expect(atr([], 14)).toBeNull()
    expect(atr([{ high: 1, low: 0.5, close: 0.9 }], 14)).toBeNull()
  })
})

describe('ema', () => {
  it('sabit seride sabit kalır', () => {
    expect(ema([5, 5, 5, 5, 5], 3)).toBeCloseTo(5, 5)
  })
  it('artan seride son değere yaklaşır', () => {
    const values = Array.from({ length: 50 }, (_, i) => i + 1)
    const e = ema(values, 5)
    expect(e).not.toBeNull()
    expect(e!).toBeGreaterThan(40)
  })
  it('boşta null', () => expect(ema([], 5)).toBeNull())
})

describe('tanhScale', () => {
  it('0 → 0, büyük → ±1 eşi', () => {
    expect(tanhScale(0, 1)).toBe(0)
    expect(tanhScale(10, 1)).toBeCloseTo(1, 5)
    expect(tanhScale(-10, 1)).toBeCloseTo(-1, 5)
  })
  it('NaN / k=0 → 0', () => {
    expect(tanhScale(Number.NaN, 1)).toBe(0)
    expect(tanhScale(1, 0)).toBe(0)
  })
})

describe('hashSeed', () => {
  it('deterministik', () => {
    expect(hashSeed('BTCUSDT:1m:')).toBe(hashSeed('BTCUSDT:1m:'))
    expect(hashSeed('a')).not.toBe(hashSeed('b'))
  })
  it('uint32 aralığında', () => {
    const h = hashSeed('x')
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThanOrEqual(0xffffffff)
  })
})
