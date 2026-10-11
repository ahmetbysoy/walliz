// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusPill } from '@/features/market-feed/ui/StatusPill'
import { OrderbookRow } from '@/features/orderbook/ui/OrderbookRow'
import { MetricCard } from '@/shared/ui/MetricCard'
import { EmptyState } from '@/shared/ui/EmptyState'
import { CandlestickChart } from 'lucide-react'

describe('StatusPill', () => {
  it('status etiketini gösterir', () => {
    render(<StatusPill status="demo" />)
    expect(screen.getByRole('button', { name: /feed durumu/i })).toHaveTextContent('DEMO')
  })

  it('canlı: CANLI etiketi', () => {
    render(<StatusPill status="live" />)
    expect(screen.getByRole('button', { name: /feed durumu/i })).toHaveTextContent('CANLI')
  })

  it("onTap verilince demo/offline'da tıklanabilir", async () => {
    const user = userEvent.setup()
    const onTap = vi.fn()
    render(<StatusPill status="demo" onTap={onTap} />)
    await user.click(screen.getByRole('button', { name: /feed durumu/i }))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it("hata message title'de görünür", () => {
    render(<StatusPill status="demo" error="ws-kopustu" />)
    expect(screen.getByRole('button', { name: /ws-kopustu/ })).toBeInTheDocument()
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
