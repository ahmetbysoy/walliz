import { beforeEach, describe, expect, it } from 'vitest'
import type { Candle } from '@/entities'
import { useMarketStore } from '@/shared/model/marketStore'

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
    useMarketStore.getState().apply({ type: 'status', status: 'demo', error: 'ws-kopustu' })
    expect(useMarketStore.getState().status).toBe('demo')
    expect(useMarketStore.getState().feedError).toBe('ws-kopustu')
  })

  it('ticker → price', () => {
    useMarketStore
      .getState()
      .apply({
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

  it('history → candles değiştirilir', () => {
    useMarketStore.getState().apply({ type: 'candle', candle: candle(1000, 100) })
    useMarketStore
      .getState()
      .apply({ type: 'history', candles: [candle(900, 90, true), candle(960, 95, true)] })
    expect(useMarketStore.getState().candles).toHaveLength(2)
  })

  it('candles 500 üst sınırı', () => {
    const st = useMarketStore.getState()
    for (let i = 0; i < 510; i++)
      st.apply({ type: 'candle', candle: candle(i * 60, 100 + i, true) })
    expect(useMarketStore.getState().candles).toHaveLength(500)
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

  it('reset her şeyi temizler', () => {
    useMarketStore.getState().apply({ type: 'candle', candle: candle(1000, 100) })
    useMarketStore.getState().reset('DOGEUSDT', '5m')
    const st = useMarketStore.getState()
    expect(st.symbol).toBe('DOGEUSDT')
    expect(st.timeframe).toBe('5m')
    expect(st.candles).toEqual([])
    expect(st.price).toBeNull()
    expect(st.status).toBe('connecting')
  })
})
