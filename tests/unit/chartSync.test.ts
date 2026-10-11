import { describe, expect, it } from 'vitest'
import type { Candle } from '@/entities'
import {
  INITIAL_SYNC_STATE,
  commitChartSync,
  planChartSync,
  type ChartSyncState,
} from '@/features/chart/lib/chartSync'

/**
 * "Cannot update oldest data, last time=[object Object], new time=[object Object]"
 * hatasının oluştuğu tüm senaryolar: plan hiçbir koşulda `tail` (artımlı update)
 * döndürmemeli, zaman geriye gidiyorsa tam yeniden çizim (`full`) istemeli.
 */

const c = (time: number, close = 100, closed = false): Candle => ({
  time,
  open: close - 1,
  high: close + 1,
  low: close - 1,
  close,
  volume: 10,
  closed,
})

const sealed = (candles: Candle[], key = 'BTCUSDT:1m', rewriteSeq = 0): ChartSyncState =>
  commitChartSync(INITIAL_SYNC_STATE, { kind: 'full' }, candles, key, rewriteSeq)

describe('planChartSync', () => {
  it('ilk veri → tam çizim', () => {
    expect(planChartSync(INITIAL_SYNC_STATE, [c(1000)], 'BTCUSDT:1m', 0)).toEqual({ kind: 'full' })
  })

  it('veri yokken ve seri boşken → hiçbir şey yapma', () => {
    expect(planChartSync(INITIAL_SYNC_STATE, [], 'BTCUSDT:1m', 0)).toEqual({ kind: 'skip' })
  })

  it('seri doluyken veri boşalırsa → seriyi boşalt', () => {
    const state = sealed([c(1000), c(1060)])
    expect(planChartSync(state, [], 'BTCUSDT:1m', 1)).toEqual({ kind: 'clear' })
  })

  it('sembol/timeframe değişince → tam çizim', () => {
    const state = sealed([c(1000), c(1060)])
    expect(planChartSync(state, [c(900), c(960)], 'ETHUSDT:1m', 1)).toEqual({ kind: 'full' })
  })

  it('son mum ilerlediğinde → artımlı güncelleme', () => {
    const state = sealed([c(1000), c(1060)])
    expect(planChartSync(state, [c(1000), c(1060), c(1120)], 'BTCUSDT:1m', 0)).toEqual({
      kind: 'tail',
      candle: c(1120),
    })
  })

  it('son mum canlı güncellendiğinde (aynı zaman, yeni fiyat) → artımlı güncelleme', () => {
    const state = sealed([c(1000), c(1060, 100)])
    const plan = planChartSync(state, [c(1000), c(1060, 105)], 'BTCUSDT:1m', 0)
    expect(plan).toEqual({ kind: 'tail', candle: c(1060, 105) })
  })

  it('veri değişmediyse → skip (boşa çizim yok)', () => {
    const state = sealed([c(1000), c(1060)])
    expect(planChartSync(state, [c(1000), c(1060)], 'BTCUSDT:1m', 0)).toEqual({ kind: 'skip' })
  })

  it('ZAMAN GERİYE SARARSA → tam çizim (çökme senaryosu 1)', () => {
    const state = sealed([c(1000), c(1060), c(1120)])
    // yeniden bağlanma sonrası gecikmeli/tekrarlanan mum
    expect(planChartSync(state, [c(1000), c(1060)], 'BTCUSDT:1m', 0)).toEqual({ kind: 'full' })
  })

  it('pencere yapısı değiştiğinde (rewriteSeq) → tam çizim (çökme senaryosu 2)', () => {
    const state = sealed([c(1000), c(1060)])
    // REST geçmişi geriye dönük 300 mum getirdi ve pencere baştan yazıldı
    expect(planChartSync(state, [c(500), c(560), c(1000)], 'BTCUSDT:1m', 1)).toEqual({
      kind: 'full',
    })
  })

  it('pencere kırpıldığında (mum sayısı azaldı) → tam çizim', () => {
    const state = sealed([c(1000), c(1060), c(1120)])
    expect(planChartSync(state, [c(1000), c(1060)], 'BTCUSDT:1m', 0)).toEqual({ kind: 'full' })
  })

  it('store sıfırlandığında (candles boş + yeni anahtar) → boşalt', () => {
    const state = sealed([c(1000), c(1060)])
    expect(planChartSync(state, [], 'ETHUSDT:5m', 5)).toEqual({ kind: 'clear' })
  })

  it('artımlı güncelleme ASLA serideki son zamandan küçük zaman taşımaz', () => {
    const state = sealed([c(1000), c(1060), c(1120)])
    const candidates: Candle[][] = [
      [c(1000), c(1060), c(1120), c(1180)],
      [c(1000), c(1060), c(1120)],
      [c(1000), c(1060)],
      [c(940), c(1000), c(1060), c(1120)],
      [c(1180)],
      [],
    ]
    for (const list of candidates) {
      for (const rewriteSeq of [0, 1, 2]) {
        const plan = planChartSync(state, list, 'BTCUSDT:1m', rewriteSeq)
        if (plan.kind === 'tail') {
          expect(plan.candle.time).toBeGreaterThanOrEqual(state.lastTime)
        }
      }
    }
  })
})

describe('commitChartSync', () => {
  it('full → pencere ve son mum kaydedilir', () => {
    const candles = [c(1000), c(1060)]
    const state = commitChartSync(INITIAL_SYNC_STATE, { kind: 'full' }, candles, 'BTCUSDT:1m', 0)
    expect(state.initialized).toBe(true)
    expect(state.count).toBe(2)
    expect(state.lastTime).toBe(1060)
    expect(state.lastCandle?.time).toBe(1060)
    expect(state.key).toBe('BTCUSDT:1m')
  })

  it('kaydedilen son mum store mutasyonundan bağımsız kopyadır', () => {
    const candles = [c(1000), c(1060, 100)]
    const state = commitChartSync(INITIAL_SYNC_STATE, { kind: 'full' }, candles, 'BTCUSDT:1m', 0)
    candles[1].close = 999
    expect(state.lastCandle?.close).toBe(100)
  })

  it('clear → durum sıfırlanır ve anahtar güncellenir', () => {
    const state = commitChartSync(sealed([c(1000)]), { kind: 'clear' }, [], 'ETHUSDT:5m', 4)
    expect(state.initialized).toBe(false)
    expect(state.count).toBe(0)
    expect(state.lastCandle).toBeNull()
    expect(state.key).toBe('ETHUSDT:5m')
    expect(state.rewriteSeq).toBe(4)
  })

  it('skip → durum aynen kalır', () => {
    const before = sealed([c(1000)])
    expect(commitChartSync(before, { kind: 'skip' }, [c(1000)], 'BTCUSDT:1m', 0)).toBe(before)
  })
})
