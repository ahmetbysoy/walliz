import { describe, expect, it } from 'vitest'
import type { Candle } from '@/entities'
import { MEASURED_AFTER_WARMUP, runBacktest } from '../../scripts/backtest'
import { INITIAL_WEIGHT_VALUES } from '@/shared/lib/model'

/**
 * Backtest çekirdeğinin birim testi.
 *
 * Not: buradaki mum dizisi bir **test fikstürüdür** (ürün verisi değil, ürün kodu
 * ağdan gerçek veri çeker). Amaç, backtest matematiğinin (karar sayımı, kova
 * dağılımı, ablasyon, ağırlık sınırları) doğruluğunu deterministik olarak ölçmek.
 */

/** Dalgalı ama deterministik fiyat serisi (fikstür). */
function fixtureCandles(count: number): Candle[] {
  const out: Candle[] = []
  let price = 100
  const t0 = 1_700_000_000
  for (let i = 0; i < count; i++) {
    const open = price
    const swing = Math.sin(i / 7) * 0.6 + Math.sin(i / 23) * 1.2
    const close = Math.max(1, open + swing)
    out.push({
      time: t0 + i * 60,
      open,
      high: Math.max(open, close) + 0.3,
      low: Math.min(open, close) - 0.3,
      close,
      volume: 100 + (i % 11),
      closed: true,
    })
    price = close
  }
  return out
}

describe('runBacktest', () => {
  it('ısınma periyodundan sonrasını ölçer ve kararları tutarlı sayar', () => {
    const candles = fixtureCandles(400)
    const report = runBacktest('TESTUSDT', candles)

    expect(report.symbol).toBe('TESTUSDT')
    expect(report.candles).toBe(400)
    expect(report.decisions + report.neutrals + report.skipped).toBe(
      candles.length - MEASURED_AFTER_WARMUP,
    )
    expect(report.hits + report.misses).toBe(report.decisions)
    expect(report.hitRate).toBeGreaterThanOrEqual(0)
    expect(report.hitRate).toBeLessThanOrEqual(1)
  })

  it('kovalar yalnızca güven bandına göre dağılır ve toplamı kararlarla uyuşur', () => {
    const report = runBacktest('TESTUSDT', fixtureCandles(500))
    const bandTotal = Object.values(report.bands).reduce((acc, b) => acc + b.total, 0)
    const bandHits = Object.values(report.bands).reduce((acc, b) => acc + b.hits, 0)

    // kova sayımı tüm kararları (isabet + ıskalama) kapsar
    expect(bandTotal).toBe(report.decisions + report.neutrals)
    expect(bandHits).toBe(report.hits)
    for (const band of ['high', 'medium', 'low']) {
      const b = report.bands[band]
      expect(b.hits).toBeLessThanOrEqual(b.total)
      expect(b.hitRate).toBeCloseTo(b.total > 0 ? b.hits / b.total : 0, 10)
    }
  })

  it('ablasyon: kitap türevi feature ağırlıkları sıfırda kalır', () => {
    const report = runBacktest('TESTUSDT', fixtureCandles(600))
    expect(report.weights.imbalance).toBe(0)
    expect(report.weights.wallPressure).toBe(0)
  })

  it('fiyat türevi ağırlıklar öğrenilir ama sınırların dışına çıkmaz (±2)', () => {
    const report = runBacktest('TESTUSDT', fixtureCandles(800))
    for (const key of ['momentum', 'trend', 'volatility']) {
      expect(Number.isFinite(report.weights[key])).toBe(true)
      expect(Math.abs(report.weights[key])).toBeLessThanOrEqual(2)
    }
    // en az bir fiyat türevi ağırlık başlangıç değerinden sapmış olmalı: öğrenme gerçekten koştu
    const learned = ['momentum', 'trend', 'volatility'].some(
      (k) => Math.abs(report.weights[k] - INITIAL_WEIGHT_VALUES[k as 'momentum']) > 1e-6,
    )
    expect(learned).toBe(true)
  })

  it('aynı fikstür → aynı sonuç (deterministik)', () => {
    const a = runBacktest('TESTUSDT', fixtureCandles(350))
    const b = runBacktest('TESTUSDT', fixtureCandles(350))
    expect(a).toEqual(b)
  })

  it('yetersiz veride hiç karar üretmez (ısınma çalışır)', () => {
    const report = runBacktest('TESTUSDT', fixtureCandles(MEASURED_AFTER_WARMUP))
    expect(report.decisions).toBe(0)
    expect(report.hitRate).toBe(0)
  })

  it('zaman/fiyat alanları raporda gerçek veriyi yansıtır', () => {
    const candles = fixtureCandles(300)
    const report = runBacktest('TESTUSDT', candles)
    expect(report.lastPrice).toBe(candles[candles.length - 1].close)
    expect(report.from).toContain('2023-11-14')
    expect(report.to > report.from).toBe(true)
  })
})
