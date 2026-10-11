import { beforeEach, describe, expect, it } from 'vitest'
import type { Candle } from '@/entities'
import { useMarketStore } from '@/shared/model/marketStore'
import { MAX_CANDLES } from '@/shared/config/coins'

const candle = (time: number, close: number, closed = false): Candle => ({
  time,
  open: close - 1,
  high: close + 1,
  low: close - 1,
  close,
  volume: 10,
  closed,
})

beforeEach(() => {
  useMarketStore.getState().reset('BTCUSDT', '1m')
})

describe('marketStore.apply', () => {
  it('status event → status + error', () => {
    useMarketStore.getState().apply({ type: 'status', status: 'offline', error: 'ws-kopustu' })
    expect(useMarketStore.getState().status).toBe('offline')
    expect(useMarketStore.getState().feedError).toBe('ws-kopustu')
  })

  it('canlı durum hatayı temizler', () => {
    useMarketStore.getState().apply({ type: 'status', status: 'offline', error: 'ws-kopustu' })
    useMarketStore.getState().apply({ type: 'status', status: 'live' })
    expect(useMarketStore.getState().status).toBe('live')
    expect(useMarketStore.getState().feedError).toBeNull()
  })

  it('ticker → price', () => {
    useMarketStore.getState().apply({
      type: 'ticker',
      ticker: { last: 67000, changePct: 1, volume24h: 1, high24h: 2, low24h: 0, ts: 1 },
    })
    expect(useMarketStore.getState().price).toBe(67000)
  })

  it('book → snapshot', () => {
    useMarketStore.getState().apply({
      type: 'book',
      book: {
        bids: [{ price: 66999, qty: 1, total: 1 }],
        asks: [{ price: 67001, qty: 1, total: 1 }],
        ts: 5,
      },
    })
    expect(useMarketStore.getState().book?.bids[0].price).toBe(66999)
  })

  it('candle: aynı time → güncelle, yeni time → ekle', () => {
    const st = useMarketStore.getState()
    st.apply({ type: 'candle', candle: candle(1000, 100) })
    st.apply({ type: 'candle', candle: candle(1000, 101) })
    expect(useMarketStore.getState().candles).toHaveLength(1)
    expect(useMarketStore.getState().price).toBe(101)
    useMarketStore.getState().apply({ type: 'candle', candle: candle(1060, 102, true) })
    expect(useMarketStore.getState().candles).toHaveLength(2)
  })

  it('gecikmeli mum listeyi geriye sarmaz, doğru sıraya girer', () => {
    const st = useMarketStore.getState()
    st.apply({ type: 'candle', candle: candle(1000, 100, true) })
    st.apply({ type: 'candle', candle: candle(1120, 102) })
    // araya giren gecikmiş mum
    useMarketStore.getState().apply({ type: 'candle', candle: candle(1060, 101, true) })
    const times = useMarketStore.getState().candles.map((c) => c.time)
    expect(times).toEqual([1000, 1060, 1120])
  })

  it('geriye dönük mum yapı değişikliği sayacını artırır (grafik tam çizim yapar)', () => {
    const st = useMarketStore.getState()
    st.apply({ type: 'candle', candle: candle(1000, 100, true) })
    st.apply({ type: 'candle', candle: candle(1120, 102) })
    const before = useMarketStore.getState().candlesRewriteSeq
    useMarketStore.getState().apply({ type: 'candle', candle: candle(1060, 101, true) })
    expect(useMarketStore.getState().candlesRewriteSeq).toBe(before + 1)
  })

  it('son mumun canlı güncellemesi sayaç artırmaz (artımlı çizim yeterli)', () => {
    const st = useMarketStore.getState()
    st.apply({ type: 'candle', candle: candle(1000, 100, true) })
    st.apply({ type: 'candle', candle: candle(1060, 101) })
    const before = useMarketStore.getState().candlesRewriteSeq
    st.apply({ type: 'candle', candle: candle(1060, 101.5) })
    expect(useMarketStore.getState().candlesRewriteSeq).toBe(before)
  })

  it('geçersiz mum (time ≤ 0) yok sayılır', () => {
    useMarketStore.getState().apply({ type: 'candle', candle: candle(0, 100) })
    useMarketStore.getState().apply({ type: 'candle', candle: candle(Number.NaN, 100) })
    expect(useMarketStore.getState().candles).toHaveLength(0)
    expect(useMarketStore.getState().price).toBeNull()
  })

  it('history → canlı mumları koruyarak birleştirir', () => {
    useMarketStore.getState().apply({ type: 'candle', candle: candle(1060, 102) })
    useMarketStore
      .getState()
      .apply({ type: 'history', candles: [candle(900, 90, true), candle(960, 95, true)] })
    const candles = useMarketStore.getState().candles
    expect(candles.map((c) => c.time)).toEqual([900, 960, 1060])
  })

  it('history geriye sarmaz: geç gelen geçmiş mum mum sırasını bozmaz', () => {
    useMarketStore.getState().apply({ type: 'candle', candle: candle(1060, 102) })
    useMarketStore.getState().apply({ type: 'history', candles: [candle(1030, 101, true)] })
    expect(useMarketStore.getState().candles.map((c) => c.time)).toEqual([1030, 1060])
  })

  it('aynı history iki kez gelirse state değişmez (gereksiz render yok)', () => {
    const candles = [candle(900, 90, true), candle(960, 95, true)]
    useMarketStore.getState().apply({ type: 'history', candles })
    const first = useMarketStore.getState().candles
    const seq = useMarketStore.getState().candlesRewriteSeq
    useMarketStore.getState().apply({ type: 'history', candles })
    expect(useMarketStore.getState().candles).toBe(first)
    expect(useMarketStore.getState().candlesRewriteSeq).toBe(seq)
  })

  it('candles üst sınırı aşılmaz', () => {
    const st = useMarketStore.getState()
    for (let i = 0; i < MAX_CANDLES + 10; i++)
      st.apply({ type: 'candle', candle: candle(i * 60, 100 + i, true) })
    expect(useMarketStore.getState().candles).toHaveLength(MAX_CANDLES)
    expect(useMarketStore.getState().candles[0].time).toBe(10 * 60)
  })

  it('setWalls walls + features yazar', () => {
    useMarketStore
      .getState()
      .setWalls(
        [{ side: 'bid', price: 99, qty: 5, levels: 3, strength: 3, ageTicks: 1, stable: false }],
        null,
      )
    expect(useMarketStore.getState().walls).toHaveLength(1)
  })

  it('reset her şeyi temizler ve grafiği tam çizime zorlar', () => {
    const st = useMarketStore.getState()
    st.apply({ type: 'candle', candle: candle(1000, 100) })
    const seq = useMarketStore.getState().candlesRewriteSeq
    useMarketStore.getState().reset('DOGEUSDT', '5m')
    const next = useMarketStore.getState()
    expect(next.symbol).toBe('DOGEUSDT')
    expect(next.timeframe).toBe('5m')
    expect(next.candles).toEqual([])
    expect(next.price).toBeNull()
    expect(next.status).toBe('connecting')
    expect(next.feedError).toBeNull()
    expect(next.candlesRewriteSeq).toBe(seq + 1)
  })
})
