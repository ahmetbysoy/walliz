// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectionNotice } from '@/app/shell/ConnectionNotice'
import { StatusPill } from '@/features/market-feed/ui/StatusPill'
import { useMarketStore } from '@/shared/model/marketStore'
import { OrderbookRow } from '@/features/orderbook/ui/OrderbookRow'
import { OrderbookPanel } from '@/features/orderbook/ui/OrderbookPanel'
import { CoinSelect } from '@/features/preferences/ui/CoinSelect'
import { MetricCard } from '@/shared/ui/MetricCard'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ConfidenceBar } from '@/shared/ui/ConfidenceBar'
import { buildBookSnapshot } from '@/shared/lib/book'
import { CandlestickChart } from 'lucide-react'

describe('StatusPill', () => {
  it('bağlantı kurulurken AÇILIYOR', () => {
    render(<StatusPill status="connecting" />)
    expect(screen.getByRole('button', { name: /feed durumu/i })).toHaveTextContent('AÇILIYOR')
  })

  it('canlı: CANLI etiketi', () => {
    render(<StatusPill status="live" />)
    expect(screen.getByRole('button', { name: /feed durumu/i })).toHaveTextContent('CANLI')
  })

  it('koptuğunda BAĞLANIYOR, veri yoksa ÇEVRİMDIŞI', () => {
    const { rerender } = render(<StatusPill status="reconnecting" />)
    expect(screen.getByRole('button', { name: /feed durumu/i })).toHaveTextContent('BAĞLANIYOR')
    rerender(<StatusPill status="offline" />)
    expect(screen.getByRole('button', { name: /feed durumu/i })).toHaveTextContent('ÇEVRİMDIŞI')
  })

  it('canlı değilken onTap ile hemen yeniden deneme sunar', async () => {
    const user = userEvent.setup()
    const onTap = vi.fn()
    render(<StatusPill status="offline" onTap={onTap} />)
    await user.click(screen.getByRole('button', { name: /feed durumu/i }))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('canlıyken tıklama yok (yeniden deneme gereksiz)', () => {
    render(<StatusPill status="live" onTap={() => {}} />)
    expect(screen.getByRole('button', { name: /feed durumu/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /feed durumu/i })).not.toHaveAttribute(
      'aria-label',
      /dokunun/,
    )
  })

  it("hata message title'de görünür", () => {
    render(<StatusPill status="offline" error="ws-kopustu" />)
    expect(screen.getByRole('button', { name: /ws-kopustu/ })).toBeInTheDocument()
  })
})

describe('ConnectionNotice', () => {
  beforeEach(() => {
    useMarketStore.getState().reset('BTCUSDT', '1m')
  })

  it('canlı bağlantıda hiçbir uyarı göstermez', () => {
    useMarketStore.getState().apply({ type: 'status', status: 'live' })
    const { container } = render(<ConnectionNotice onRetry={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('veri yokken çevrimdışı uyarısı ve nedenini gösterir', () => {
    useMarketStore.getState().apply({ type: 'status', status: 'offline', error: 'ws-kopustu:1006' })
    render(<ConnectionNotice onRetry={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Canlı piyasa verisine ulaşılamıyor')
    expect(screen.getByRole('alert')).toHaveTextContent('ws-kopustu:1006')
  })

  it('Dene butonu yeniden bağlanmayı tetikler', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    useMarketStore.getState().apply({ type: 'status', status: 'offline' })
    render(<ConnectionNotice onRetry={onRetry} />)
    await user.click(screen.getByRole('button', { name: 'Dene' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe('MetricCard', () => {
  it('label + value + sub render eder', () => {
    render(<MetricCard label="Son Fiyat" value="67.000,00" sub="USDT" variant="price" />)
    expect(screen.getByText('Son Fiyat')).toBeInTheDocument()
    expect(screen.getByText('67.000,00')).toBeInTheDocument()
  })

  it('up/down varyantı renk sınıfı taşır', () => {
    const { rerender } = render(<MetricCard label="x" value="1" variant="up" />)
    expect(screen.getByText('1')).toHaveClass('text-mint')
    rerender(<MetricCard label="x" value="1" variant="down" />)
    expect(screen.getByText('1')).toHaveClass('text-coral')
  })
})

describe('OrderbookRow', () => {
  it('fiyat/hacim/total gösterir', () => {
    render(
      <OrderbookRow
        level={{ price: 67000.5, qty: 120, total: 340 }}
        side="bid"
        maxTotal={400}
        decimals={2}
        isWall={false}
        onLongPress={() => {}}
      />,
    )
    expect(screen.getByText('67,000.50')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
  })

  it('duvar satırında sr-only etiket', () => {
    render(
      <OrderbookRow
        level={{ price: 67000.5, qty: 120, total: 340 }}
        side="bid"
        maxTotal={400}
        decimals={2}
        isWall
        onLongPress={() => {}}
      />,
    )
    expect(screen.getByText('Duvar')).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('ikon + başlık + ipucu', () => {
    render(
      <EmptyState icon={CandlestickChart} title="Bekleniyor" hint="Veri gelene kadar buradayız" />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Bekleniyor')
    expect(screen.getByText('Veri gelene kadar buradayız')).toBeInTheDocument()
  })
})

describe('OrderbookPanel — gerçek kitap görünümü', () => {
  beforeEach(() => {
    useMarketStore.setState({
      symbol: 'BTCUSDT',
      book: buildBookSnapshot(
        [
          ['67000', '1'],
          ['66999', '2'],
          ['66998', '3'],
        ],
        [
          ['67010', '1'],
          ['67011', '1'],
          ['67012', '8'],
        ],
        1_700_000_000_000,
        42,
      ),
      walls: [],
    })
  })

  /** Bir fiyat satırındaki derinlik çubuğunun genişliği */
  function barWidthFor(priceText: string): string {
    const priceEl = screen.getByText(priceText)
    const row = priceEl.parentElement as HTMLElement
    const bar = row.querySelector('span[aria-hidden="true"]') as HTMLElement | null
    return bar?.style.width ?? ''
  }

  it('spread yüzdesi oran olarak değil yüzde olarak biçimlenir', () => {
    render(<OrderbookPanel />)
    // 67010 / 67000 - 1 = %0.0149 → iki hane: %0.01 (eskiden oran verilip %0.00 görünüyordu)
    expect(screen.getByText(/\+0\.01%/)).toBeInTheDocument()
    expect(screen.getByText('10.00 (+0.01%)')).toBeInTheDocument()
  })

  it('derinlik çubukları en derin kümülatif toplama göre oranlanır', () => {
    render(<OrderbookPanel />)
    // bids kümülatif: 67000→1, 66999→3, 66998→6 · asks: 67010→1, 67011→2, 67012→10
    expect(barWidthFor('67,012.00')).toBe('100%')
    expect(barWidthFor('66,998.00')).toBe('60%')
    expect(barWidthFor('67,000.00')).toBe('10%')
    // en iyi seviyeler tavana yapışmamalı
    expect(barWidthFor('67,000.00')).not.toBe('100%')
  })

  it('kitap yokken uydurma seviye göstermez', () => {
    useMarketStore.setState({ book: null })
    render(<OrderbookPanel />)
    expect(screen.getByRole('status')).toHaveTextContent('Orderbook bekleniyor')
  })
})

describe('ConfidenceBar / CoinSelect', () => {
  it('güven çubuğu erişilebilir etikette gerçek yüzdeyi taşır', () => {
    render(<ConfidenceBar value={0.73} />)
    expect(screen.getByRole('progressbar', { name: 'Güven %73' })).toBeInTheDocument()
  })

  it('coin tetikleyicisi yalnızca kısa kodu gösterir (ipucu listede kalır)', () => {
    render(<CoinSelect value="BTCUSDT" onChange={() => {}} />)
    const trigger = screen.getByRole('combobox', { name: 'Coin seç' })
    expect(trigger).toHaveTextContent('BTC')
    expect(trigger).not.toHaveTextContent('Bitcoin')
  })
})
