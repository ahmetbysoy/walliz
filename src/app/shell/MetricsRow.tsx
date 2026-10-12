import { getCoin } from '@/shared/config/coins'
import { formatCompact, formatPct, formatPrice } from '@/shared/lib/format'
import { useMarketStore } from '@/shared/model/marketStore'
import { MetricCard } from '@/shared/ui/MetricCard'

export function MetricsRow() {
  const price = useMarketStore((s) => s.price)
  const ticker = useMarketStore((s) => s.ticker)
  const book = useMarketStore((s) => s.book)
  const symbol = useMarketStore((s) => s.symbol)
  const coin = getCoin(symbol)

  const bestBid = book?.bids[0]?.price
  const bestAsk = book?.asks[0]?.price
  const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null
  const spreadPct = bestBid != null && bestAsk != null && bestBid > 0 ? bestAsk / bestBid - 1 : null

  return (
    <div className="grid grid-cols-2 gap-2">
      <MetricCard
        label={`${coin.base} Son Fiyat`}
        value={formatPrice(price ?? Number.NaN, coin.priceDecimals)}
        variant="price"
        sub="USDT"
      />
      <MetricCard
        label="24s Değişim"
        value={ticker ? formatPct(ticker.changePct) : '—'}
        variant={ticker ? (ticker.changePct >= 0 ? 'up' : 'down') : 'default'}
        sub={ticker ? `Yüksek: ${formatPrice(ticker.high24h, coin.priceDecimals)}` : undefined}
      />
      <MetricCard
        label="24s Hacim"
        value={ticker ? formatCompact(ticker.volume24h) : '—'}
        sub={coin.base}
      />
      <MetricCard
        label="Spread"
        value={spreadPct != null ? formatPct(spreadPct * 100) : '—'}
        sub={spread != null ? formatPrice(spread, coin.priceDecimals) : undefined}
      />
    </div>
  )
}
