import { describe, expect, it } from 'vitest'
import type { Candle } from '@/entities'
import { mergeHistory, sameCandleList, upsertCandle } from '@/shared/lib/candles'

const c = (time: number, close = 100, closed = false): Candle => ({
  time,
  open: close - 1,
  high: close + 1,
  low: close - 1,
  close,
  volume: 10,
  closed,
})

describe('upsertCandle — gerçek feed sıralama kuralları', () => {
  it('aynı zaman → günceller, yeni kayıt eklemez', () => {
    const list = upsertCandle([c(1000, 100)], c(1000, 101))
    expect(list).toHaveLength(1)
    expect(list[0].close).toBe(101)
  })

  it('daha yeni zaman → sona ekler', () => {
    const list = upsertCandle([c(1000)], c(1060))
    expect(list.map((x) => x.time)).toEqual([1000, 1060])
  })

  it('daha eski zaman (gecikmeli/tekrarlanan mesaj) → doğru sıraya ekler', () => {
    const list = upsertCandle([c(1000), c(1060), c(1120)], c(1030))
    expect(list.map((x) => x.time)).toEqual([1000, 1030, 1060, 1120])
  })

  it('araya giren geç mum, en eski ana da eklenebilir', () => {
    const list = upsertCandle([c(1060), c(1120)], c(1000))
    expect(list.map((x) => x.time)).toEqual([1000, 1060, 1120])
  })

  it('kapanmış mum canlı veriyle açılmaz (closed bayrağı korunur)', () => {
    const list = upsertCandle([c(1000, 100, true)], c(1000, 101, false))
    expect(list[0].closed).toBe(true)
    expect(list[0].close).toBe(101)
  })

  it('hiçbir değişiklik yoksa girdi referansı korunur (gereksiz render yok)', () => {
    const before = [c(1000, 100), c(1060, 101)]
    expect(upsertCandle(before, c(1060, 101))).toBe(before)
  })

  it('üst sınır aşılırsa en eski mumlar düşer', () => {
    let list: Candle[] = []
    for (let i = 0; i < 520; i++) list = upsertCandle(list, c(i * 60, 100 + i))
    expect(list).toHaveLength(500)
    expect(list[0].time).toBe(20 * 60)
    expect(list[499].time).toBe(519 * 60)
  })
})

describe('mergeHistory — REST geçmişi + canlı mumlar', () => {
  it('canlıda olan ama geçmişte olmayan mumlar korunur', () => {
    const live = [c(1060, 200)]
    const merged = mergeHistory(live, [c(1000, 100), c(1030, 101)])
    expect(merged.map((x) => x.time)).toEqual([1000, 1030, 1060])
    expect(merged[2].close).toBe(200)
  })

  it('geçmiş mum kapalıysa kesin kaynak geçmiş olur', () => {
    const live = [c(1000, 105, false)]
    const merged = mergeHistory(live, [c(1000, 100, true)])
    expect(merged[0].close).toBe(100)
    expect(merged[0].closed).toBe(true)
  })

  it('ikisi de açık mum ise daha taze olan canlı veri kazanır', () => {
    const live = [c(1000, 105, false)]
    const merged = mergeHistory(live, [c(1000, 100, false)])
    expect(merged[0].close).toBe(105)
  })

  it('geçmiş geriye sarsa bile sonuç artan sırada kalır', () => {
    const live = [c(2000, 500), c(2060, 501)]
    const merged = mergeHistory(live, [c(1000, 100), c(1060, 101), c(1120, 102)])
    expect(merged.map((x) => x.time)).toEqual([1000, 1060, 1120, 2000, 2060])
  })

  it('aynı zaman iki kez gelmez', () => {
    const merged = mergeHistory([c(1000, 100)], [c(1000, 100), c(1000, 101)])
    expect(merged).toHaveLength(1)
  })
})

describe('sameCandleList', () => {
  it('içerik aynıysa true, tek fark varsa false', () => {
    const a = [c(1000, 100), c(1060, 101)]
    expect(sameCandleList(a, [c(1000, 100), c(1060, 101)])).toBe(true)
    expect(sameCandleList(a, [c(1000, 100), c(1060, 102)])).toBe(false)
    expect(sameCandleList(a, [c(1000, 100)])).toBe(false)
  })
})
