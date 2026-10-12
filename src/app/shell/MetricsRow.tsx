import { getCoin } from '@/shared/config/coins'
import { formatCompact, formatPct, formatPrice } from '@/shared/lib/format'
import { useMarketStore } from '@/shared/model/marketStore'
import { Skeleton } from '@/shared/ui/Skeleton'

/**
 * Tek satırlık kompakt stat şeridi (T-P0-3: hedef ≤ 28px).
 * Fiyat ve 24s değişim header'a taşındı.
 * Kalan metrikler: 24s Hacim · 24s Yüksek/Düşük · Spread
 */
export function MetricsRow() {
  const ticker = useMarketStore((s) => s.ticker)
  const book = useMarketStore((s) => s.book)
  const symbol = useMarketStore((s) => s.symbol)
  const status = useMarketStore((s) => s.status)
  const coin = getCoin(symbol)

  const bestBid = book?.bids[0]?.price
  const bestAsk = book?.asks[0]?.price
  const spreadPct = bestBid != null && bestAsk != null && bestBid > 0 ? bestAsk / bestBid - 1 : null

  if (status === 'connecting' && !ticker) {
    return (
      <div className="flex h-6 items-center gap-2 px-1">
        <Skeleton className="h-4 w-24 rounded" />
        <span className="text-muted/40">·</span>
        <Skeleton className="h-4 w-28 rounded" />
        <span className="text-muted/40">·</span>
        <Skeleton className="h-4 w-20 rounded" />
      </div>
    )
  }

  return (
    <div
      data-no-swipe
      className="flex h-6 items-center gap-2 overflow-x-auto no-scrollbar px-1 text-xs tabular-nums text-muted whitespace-nowrap"
      role="region"
      aria-label="Piyasa istatistikleri"
    >
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-muted/80">Hacim:</span>
        <span className="font-medium text-text">
          {ticker ? formatCompact(ticker.volume24h) : '—'}
        </span>
        <span className="text-[11px] text-muted">{coin.base}</span>
      </div>

      <span className="text-muted/40" aria-hidden>·</span>

      <div className="flex items-center gap-1">
        <span className="text-[11px] text-muted/80">Y/D:</span>
        <span className="text-text">
          {ticker ? formatPrice(ticker.high24h, coin.priceDecimals) : '—'} /{' '}
          {ticker ? formatPrice(ticker.low24h, coin.priceDecimals) : '—'}
        </span>
      </div>

      <span className="text-muted/40" aria-hidden>·</span>

      <div className="flex items-center gap-1">
        <span className="text-[11px] text-muted/80">Spread:</span>
        <span className="text-text">
          {spreadPct != null ? formatPct(spreadPct * 100) : '—'}
        </span>
      </div>
    </div>
  )
}
