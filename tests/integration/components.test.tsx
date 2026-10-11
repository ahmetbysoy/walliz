// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectionNotice } from '@/app/shell/ConnectionNotice'
import { StatusPill } from '@/features/market-feed/ui/StatusPill'
import { useMarketStore } from '@/shared/model/marketStore'
import { OrderbookRow } from '@/features/orderbook/ui/OrderbookRow'
import { MetricCard } from '@/shared/ui/MetricCard'
import { EmptyState } from '@/shared/ui/EmptyState'
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
