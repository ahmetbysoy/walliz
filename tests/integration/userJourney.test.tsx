// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { Providers } from '@/app/providers'
import { createEmptyLearningState } from '@/shared/lib/learningRepo'
import { useMarketStore } from '@/shared/model/marketStore'
import { useLearningStore } from '@/shared/model/learningStore'

/**
 * Kullanıcı oturumu testi — uygulamayı bir kişi gibi baştan sona kullanır.
 *
 * Kapsam (README'de vaat edilen özellikler):
 *   açılış → CANLI → fiyat/24s/spread → Grafik (tahmin) → Duvarlar (orderbook + duvar)
 *   → Kovalar (doğrulama) → Hafıza (istatistik) → coin/timeframe değişimi
 *   → bağlantı kopması (dürüst çevrimdışı durum; uydurma veri yok).
 *
 * Transport (WebSocket/fetch) taklit edilir; gönderilen yükler Binance'in RESMÎ tel
 * formatındadır (bkz. tests/integration/binanceWireContract.test.ts): kısmi derinlik
 * `{lastUpdateId, bids, asks}` (e alanı YOK), kline `{e:'kline', k:{…}}`,
 * ticker `{e:'24hrTicker', c, P, h, l, v}`. Uydurma piyasa verisi üretilmez —
 * feed yalnızca gelen gerçek tel formatındaki mesajları işler.
 */

vi.mock('@/features/chart/ui/CandleChart', () => ({
  default: () => <div data-chart-root data-testid="chart" />,
}))

const BASE = 1_700_000_000_000
const HISTORY_COUNT = 45
const TF_MS = 60_000
const LAST_HISTORY_TIME = BASE + (HISTORY_COUNT - 1) * TF_MS
/** Duvarların "stabil" sayılması için gereken ardışık derinlik mesajı sayısı */
const WALL_STABLE_TICKS = 5

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
  drop(code = 1006) {
    this.readyState = 3
    this.onclose?.({ code })
  }
  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify({ stream: 's', data: payload }) })
  }
}

/** Binance `/api/v3/klines` satırı: [openTime, o, h, l, c, v, closeTime, …] */
function klineRow(openTimeMs: number, o: number, c: number, closeTimeMs: number): unknown[] {
  return [
    openTimeMs,
    String(o),
    String(Math.max(o, c) * 1.0005),
    String(Math.min(o, c) * 0.9995),
    String(c),
    '9.5',
    closeTimeMs,
    '100',
    12,
    '50',
    '60',
    '0',
  ]
}

function historyRows(): unknown[] {
  const rows: unknown[] = []
  let price = 67_000
  for (let i = 0; i < HISTORY_COUNT; i++) {
    const open = price
    const close = price + (i % 4 === 0 ? -9 : 7)
    rows.push(klineRow(BASE + i * TF_MS, open, close, BASE + (i + 1) * TF_MS - 1))
    price = close
  }
  return rows
}

/**
 * Gerçek `@depth20@100ms` yükü: 20 seviye/taraf, `{lastUpdateId, bids, asks}`.
 * `heavyAt` verilen bid fiyatlarında hacim kümelenmesi oluşturur (duvar adayı).
 */
function depthPayload(lastUpdateId: number, center: number, heavyAt: number[] = []) {
  const bids: [string, string][] = []
  const asks: [string, string][] = []
  for (let i = 0; i < 20; i++) {
    bids.push([(center - 1 - i).toFixed(2), heavyAt.includes(center - 1 - i) ? '14' : '1'])
    asks.push([(center + 1 + i).toFixed(2), '1'])
  }
  return { lastUpdateId, bids, asks }
}

function tickerPayload(last: number, changePct: number) {
  return {
    e: '24hrTicker',
    c: last.toFixed(2),
    P: changePct.toFixed(2),
    h: (last * 1.02).toFixed(2),
    l: (last * 0.98).toFixed(2),
    v: '12345.6',
  }
}

function closedCandle(timeMs: number, close: number) {
  return {
    e: 'kline',
    k: {
      t: timeMs,
      o: close.toFixed(2),
      h: (close * 1.001).toFixed(2),
      l: (close * 0.999).toFixed(2),
      c: close.toFixed(2),
      v: '9.5',
      x: true,
    },
  }
}

beforeEach(() => {
  FakeWebSocket.instances = []
  useMarketStore.getState().reset('BTCUSDT', '1m')
  useLearningStore.setState({
    symbol: '',
    loaded: false,
    revision: 0,
    state: createEmptyLearningState(),
  })
  vi.stubGlobal('WebSocket', FakeWebSocket)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => historyRows() })),
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function openApp(): Promise<FakeWebSocket> {
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

/** Derinliği kararlılık eşiğini aşacak kadar gönderir */
function streamDepth(ws: FakeWebSocket, center: number, heavyAt: number[] = []) {
  for (let i = 0; i < WALL_STABLE_TICKS; i++) {
    ws.emit(depthPayload(100 + i, center, heavyAt))
  }
}

/** Tahmin üretir, sonra sonucu işler (Kovalar/Hafıza için 1 doğrulama oluşur) */
async function produceOneValidation(ws: FakeWebSocket, price = 67_050) {
  ws.emit(tickerPayload(price, 0.8))
  streamDepth(ws, price)
  ws.emit(closedCandle(LAST_HISTORY_TIME + TF_MS, price + 10))
  await screen.findByText('Model Tahmini', {}, { timeout: 5000 })
  ws.emit(closedCandle(LAST_HISTORY_TIME + 2 * TF_MS, price + 60))
  await waitFor(() => expect(screen.getByText('Son sonuç')).toBeInTheDocument(), { timeout: 5000 })
}

describe('kullanıcı oturumu — baştan sona akış', () => {
  it('açılışta CANLI olur; fiyat, 24s değişim, hacim ve spread gerçek veriyle dolar', async () => {
    const ws = await openApp()

    ws.emit(tickerPayload(67_432.1, 1.5))
    ws.emit(depthPayload(101, 67_010))

    await waitFor(() => expect(screen.getAllByText('67,432.10').length).toBeGreaterThan(0))
    expect(screen.getAllByText('+1.50%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('12.35K').length).toBeGreaterThan(0)
    // spread kitaptan hesaplanır: 67,011 / 66,989 arası fark
    await waitFor(() => expect(screen.getAllByText(/\+0\.\d\d%/).length).toBeGreaterThan(0))
  })

  it('Duvarlar sekmesi gerçek kitabı listeler ve hacim kümelenmesini duvar olarak işaretler', async () => {
    const user = userEvent.setup()
    const ws = await openApp()
    ws.emit(tickerPayload(67_000, 0.5))
    streamDepth(ws, 67_000, [66_995, 66_994, 66_993, 66_992])

    await user.click(screen.getByRole('button', { name: 'Duvarlar' }))

    const bids = await screen.findByLabelText('Alış tarafı (bids)')
    expect(within(bids).getAllByText(/66,9\d\d\.00/).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Satış tarafı (asks)')).toBeInTheDocument()

    await waitFor(() => expect(screen.getAllByText(/DESTEK|DİRENÇ/).length).toBeGreaterThan(0))
    // duvar işaretli satırlar arayüzde görünür (sr-only "Duvar" etiketi)
    expect(screen.getAllByText('Duvar').length).toBeGreaterThan(0)
  })

  it('Grafik sekmesi: kitap hazırken kapanan mum tahmin üretir, sonraki mum sonucu işler', async () => {
    const ws = await openApp()
    ws.emit(tickerPayload(67_050, 0.8))
    streamDepth(ws, 67_050)

    ws.emit(closedCandle(LAST_HISTORY_TIME + TF_MS, 67_060))
    expect(await screen.findByText('Model Tahmini', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getAllByText(/GÜVEN %\d+/).length).toBeGreaterThan(0)

    ws.emit(closedCandle(LAST_HISTORY_TIME + 2 * TF_MS, 67_090))
    await waitFor(() => expect(screen.getByText('Son sonuç')).toBeInTheDocument(), {
      timeout: 5000,
    })
    // sonuç metni kartta + bildirimde + (gizli) Kovalar bölümünde görünür
    expect(screen.getAllByText(/isabet|ıskaladı|nötr/).length).toBeGreaterThan(0)
  })

  it('Kovalar ve Hafıza sekmeleri gerçek doğrulamayla dolar', async () => {
    const user = userEvent.setup()
    const ws = await openApp()
    await produceOneValidation(ws)

    await user.click(screen.getByRole('button', { name: 'Kovalar' }))
    expect(await screen.findByText('Doğruluk Kovaları')).toBeInTheDocument()
    // 2 doğrulama: (1) açılışta son kapanmış geçmiş mumundan üretilen tahmin canlı kapanışta
    // çözülür, (2) o kapanışta üretilen tahmin sonraki kapanışta çözülür
    expect(screen.getByText(/Toplam 2 doğrulama/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hafıza' }))
    expect(await screen.findByText('Ağırlıklar')).toBeInTheDocument()
    expect(screen.getByText('Son Doğrulamalar')).toBeInTheDocument()
    expect(screen.getByLabelText(/Öğrenme verisini JSON olarak indir/)).toBeInTheDocument()
    // istatistik kutusunda "Toplam" değeri gerçek doğrulama sayısı
    const hafiza = screen.getByRole('region', { name: 'Hafıza' })
    const statLabel = within(hafiza).getByText('Toplam')
    expect(statLabel.parentElement).toHaveTextContent('2')
  })

  it('coin değişiminde eski fiyat temizlenir ve yeni sembol akışı kurulur', async () => {
    const user = userEvent.setup()
    const ws = await openApp()
    ws.emit(tickerPayload(67_432.1, 1.5))
    await waitFor(() => expect(screen.getAllByText('67,432.10').length).toBeGreaterThan(0))

    // Coin değişimi: başlıktaki CoinSelect'in tetiklediği aksiyonun aynısı.
    // (Radix Select menüsü jsdom'da açılıp hemen kapanıyor — menü etkileşimi gerçek
    //  tarayıcı gerektirir; burada uygulamanın sembol değişimine tepkisi sınanır.)
    useMarketStore.getState().reset('ETHUSDT', '1m')

    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(1))
    const ethWs = FakeWebSocket.last()
    expect(ethWs.url).toContain('ethusdt@depth20@100ms')
    expect(ethWs.url).toContain('ethusdt@kline_1m')
    // önceki sembolün fiyatı gösterilmez (eski veri "canlı" gibi durmaz)
    expect(screen.queryByText('67,432.10')).not.toBeInTheDocument()

    ethWs.open()
    await user.click(screen.getByRole('tab', { name: '5m mum' }))
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(2))
    expect(FakeWebSocket.last().url).toContain('ethusdt@kline_5m')
  })

  it('bağlantı koparsa dürüst çevrimdışı durumu gösterir; uydurma veri üretmez', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let ws = await openApp()
    ws.emit(tickerPayload(67_432.1, 1.5))
    await waitFor(() => expect(screen.getAllByText('67,432.10').length).toBeGreaterThan(0))

    // ardışık başarısız denemeler: her kopmadan sonra backoff kadar zaman geçer,
    // yeni soket de açılmaz (gerçek ağ yok senaryosu) → durum çevrimdışına iner
    for (let i = 0; i < 6; i++) {
      ws.drop()
      await vi.advanceTimersByTimeAsync(35_000)
      ws = FakeWebSocket.last()
    }

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /feed durumu/i })).toHaveTextContent('ÇEVRİMDIŞI'),
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Canlı piyasa verisine ulaşılamıyor')
    // son bilinen gerçek fiyat korunur; yerine uydurma fiyat konmaz
    expect(screen.getAllByText('67,432.10').length).toBeGreaterThan(0)
  })
})
