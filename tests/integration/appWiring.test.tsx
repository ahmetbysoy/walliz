// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { Providers } from '@/app/providers'
import { useMarketStore } from '@/shared/model/marketStore'
import { useLearningStore } from '@/shared/model/learningStore'
import { TimeframeChips } from '@/shared/ui/TimeframeChips'

/**
 * App kablolama testi — borsa tel formatı → store → UI.
 */

vi.mock('@/features/chart/ui/CandleChart', () => ({
  default: () => {
    const timeframe = useMarketStore.getState().timeframe
    const symbol = useMarketStore.getState().symbol
    return (
      <div data-chart-root data-testid="chart">
        <TimeframeChips
          value={timeframe}
          onChange={(tf: string) => useMarketStore.getState().reset(symbol, tf)}
        />
      </div>
    )
  },
}))

const BASE = 1_700_000_000_000
const HISTORY_COUNT = 45
const LAST_HISTORY_TIME = BASE + (HISTORY_COUNT - 1) * 60_000

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static last(): FakeWebSocket {
    return FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
  }
  url: string
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: ((ev: { code: number }) => void) | null = null
  readyState = 0
  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }
  close() {
    this.readyState = 3
  }
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify({ stream: 's', data: payload }) })
  }
}

/** Binance `/api/v3/klines` satırı: [openTime, o, h, l, c, v, closeTime, ...] */
function klineRow(openTimeMs: number, o: number, c: number, closeTimeMs: number): unknown[] {
  const high = Math.max(o, c) * 1.001
  const low = Math.min(o, c) * 0.999
  return [
    openTimeMs,
    String(o),
    String(high),
    String(low),
    String(c),
    '9',
    closeTimeMs,
    '',
    0,
    '',
    '',
    '',
  ]
}

function historyRows(): unknown[] {
  const rows: unknown[] = []
  let price = 67_000
  for (let i = 0; i < HISTORY_COUNT; i++) {
    const open = price
    const close = price + (i % 5 === 0 ? -8 : 6)
    rows.push(klineRow(BASE + i * 60_000, open, close, BASE + (i + 1) * 60_000 - 1))
    price = close
  }
  return rows
}

beforeEach(() => {
  FakeWebSocket.instances = []
  useMarketStore.getState().reset('BTCUSDT', '1m')
  useLearningStore.setState({ symbol: '', loaded: false, revision: 0 })
  vi.stubGlobal('WebSocket', FakeWebSocket)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => historyRows(),
    })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function mountApp(): Promise<FakeWebSocket> {
  render(
    <Providers>
      <App />
    </Providers>,
  )
  await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0), { timeout: 5000 })
  const ws = FakeWebSocket.last()
  ws.open()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /feed durumu/i })).toHaveTextContent('CANLI'),
  )
  return ws
}

function emitClosedCandle(ws: FakeWebSocket, close = '67080') {
  ws.emit({
    e: 'kline',
    k: { t: LAST_HISTORY_TIME, o: '67000', h: '67100', l: '66950', c: close, v: '42', x: true },
  })
}

describe('App — gerçek feed mesajları arayüze ulaşır', () => {
  it('REST geçmişi + WS ticker → header gerçek fiyatı ve 24s değişimi gösterir', async () => {
    const ws = await mountApp()
    ws.emit({
      e: '24hrTicker',
      c: '67432.10',
      P: '1.50',
      h: '68000',
      l: '66000',
      v: '12345.6',
    })
    await waitFor(() => expect(screen.getAllByText('67,432.10').length).toBeGreaterThan(0))
    expect(screen.getAllByText('+1.50%').length).toBeGreaterThan(0)
  })

  it('kısmi derinlik → duvarlar paneli gerçek kitap seviyelerini listeler', async () => {
    const ws = await mountApp()
    ws.emit({
      lastUpdateId: 5,
      bids: [
        ['67000.00', '1.5'],
        ['66990.00', '2'],
      ],
      asks: [['67010.00', '1.2']],
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Duvarlar' }))
    await waitFor(() => expect(screen.getByLabelText('Alış tarafı (bids)')).toBeInTheDocument())
    expect(screen.getByLabelText('Satış tarafı (asks)')).toBeInTheDocument()
    expect(screen.getAllByText('67,000.00').length).toBeGreaterThan(0)
  })

  it('kapalı mum KİTAPTAN ÖNCE gelirse: kitap gelince tahmin üretilir (mum atlanmaz)', async () => {
    const ws = await mountApp()
    // 1) mum kapanışı — kitap henüz yok, bu anda tahmin üretilemez
    emitClosedCandle(ws)
    await waitFor(() => expect(useMarketStore.getState().candles.at(-1)?.closed).toBe(true))
    expect(screen.queryByText(/SİNYAL GÜCÜ|YUKARI|AŞAĞI/)).toBeNull()

    // 2) derinlik gelir → bekleyen kapalı mum için tahmin üretilir
    ws.emit({ lastUpdateId: 5, bids: [['67000', '3']], asks: [['67010', '3']] })
    await waitFor(() => expect(screen.getByText(/Model Tahmini/i)).toBeInTheDocument(), {
      timeout: 5000,
    })
    expect(useLearningStore.getState().state.pending?.basePrice).toBe(67080)
  })

  it('kapalı mum + kitap hazırken tahmin tek seferlik üretilir (kitap akışı tekrarlatmaz)', async () => {
    const ws = await mountApp()
    ws.emit({ lastUpdateId: 5, bids: [['67000', '3']], asks: [['67010', '3']] })
    await waitFor(() => expect(useMarketStore.getState().book).not.toBeNull())
    emitClosedCandle(ws)
    await waitFor(() => expect(screen.getByText(/Model Tahmini/i)).toBeInTheDocument(), {
      timeout: 5000,
    })
    const first = useLearningStore.getState().state.pending?.id
    expect(first).toBeTruthy()

    // 100 ms'de bir gelen derinlik güncellemeleri yeni tahmin üretmemeli
    ws.emit({ lastUpdateId: 6, bids: [['67001', '4']], asks: [['67011', '4']] })
    ws.emit({ lastUpdateId: 7, bids: [['67002', '4']], asks: [['67012', '4']] })
    await new Promise((r) => setTimeout(r, 200))
    expect(useLearningStore.getState().state.pending?.id).toBe(first)
    expect(useLearningStore.getState().state.stats.total).toBe(0)
  })

  it('bağlantı hiç kurulmazsa veri uydurulmaz, durum bildirilir', async () => {
    render(
      <Providers>
        <App />
      </Providers>,
    )
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0), {
      timeout: 5000,
    })
    const ws = FakeWebSocket.last()
    ws.open()
    ws.onclose?.({ code: 1006 })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /feed durumu/i })).toHaveTextContent(
        /BAĞLANIYOR|ÇEVRİMDIŞI/,
      ),
    )
  })
})
