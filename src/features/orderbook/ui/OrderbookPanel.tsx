import { useMemo, useState } from 'react'
import { BookOpen, Radar } from 'lucide-react'
import type { BookLevel, WallSide } from '@/entities'
import { getCoin } from '@/shared/config/coins'
import { formatCompact, formatPct, formatPrice } from '@/shared/lib/format'
import { haptic } from '@/shared/lib/haptics'
import { useMarketStore } from '@/shared/model/marketStore'
import { Card, CardTitle } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Sheet } from '@/shared/ui/Sheet'
import { OrderbookRow } from './OrderbookRow'

export function OrderbookPanel() {
  const book = useMarketStore((s) => s.book)
  const walls = useMarketStore((s) => s.walls)
  const symbol = useMarketStore((s) => s.symbol)
  const coin = getCoin(symbol)
  const [detail, setDetail] = useState<{ level: BookLevel; side: WallSide } | null>(null)

  const wallByPrice = useMemo(() => new Map(walls.map((w) => [`${w.side}:${w.price}`, w])), [walls])
  const maxTotal = useMemo(
    () => (book ? Math.max(book.bids[0]?.total ?? 0, book.asks[0]?.total ?? 0) : 0),
    [book],
  )

  if (!book || book.bids.length === 0 || book.asks.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Orderbook bekleniyor"
        hint="Feed bağlandığında ilk 20 seviye burada listelenir."
      />
    )
  }

  const bestBid = book.bids[0].price
  const bestAsk = book.asks[0].price
  const spread = bestAsk - bestBid
  const spreadPct = bestAsk / bestBid - 1
  const openDetail = (level: BookLevel, side: WallSide) => {
    haptic(15)
    setDetail({ level, side })
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex items-center justify-between px-4 py-3 text-xs tabular-nums">
        <span className="text-muted">Spread</span>
        <span className="font-medium text-text">
          {formatPrice(spread, coin.priceDecimals)} ({formatPct(spreadPct)})
        </span>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-[1fr_1fr_1fr_1.5rem] items-center gap-0 border-b border-line px-3 py-2 text-[10px] uppercase tracking-wider text-muted">
          <span>Fiyat</span>
          <span>Hacim</span>
          <span>Toplam</span>
          <span className="sr-only">Duvar</span>
        </div>
        <div aria-label="Alış tarafı (bids)">
          {[...book.bids].reverse().map((l) => (
            <OrderbookRow
              key={`b-${l.price}`}
              level={l}
              side="bid"
              maxTotal={maxTotal}
              decimals={coin.priceDecimals}
              isWall={wallByPrice.has(`bid:${l.price}`)}
              onLongPress={openDetail}
            />
          ))}
        </div>
        <div className="mx-3 my-1 border-t border-line" aria-hidden />
        <div aria-label="Satış tarafı (asks)">
          {book.asks.map((l) => (
            <OrderbookRow
              key={`a-${l.price}`}
              level={l}
              side="ask"
              maxTotal={maxTotal}
              decimals={coin.priceDecimals}
              isWall={wallByPrice.has(`ask:${l.price}`)}
              onLongPress={openDetail}
            />
          ))}
        </div>
      </Card>

      {walls.length > 0 && (
        <Card>
          <CardTitle className="mb-2 flex items-center gap-1.5">
            <Radar className="size-3.5" aria-hidden /> Aktif Duvarlar
          </CardTitle>
          <ul className="flex flex-col gap-2">
            {walls.map((w) => (
              <li
                key={`${w.side}-${w.price}`}
                className="flex items-center justify-between rounded-lg bg-surface-2/60 px-3 py-2 text-xs tabular-nums"
              >
                <span className={w.side === 'bid' ? 'text-mint' : 'text-coral'}>
                  {w.side === 'bid' ? 'DESTEK' : 'DİRENÇ'}{' '}
                  {formatPrice(w.price, coin.priceDecimals)}
                </span>
                <span className="flex items-center gap-2 text-muted">
                  <span>
                    {formatCompact(w.qty)} · {w.strength.toFixed(1)}×
                  </span>
                  <span className="text-text/70">{w.stable ? 'stabil' : `${w.ageTicks} tick`}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Sheet
        open={detail !== null}
        onOpenChange={(o) => !o && setDetail(null)}
        title="Seviye Detayı"
      >
        {detail && (
          <div className="flex flex-col gap-2 text-sm tabular-nums">
            <DetailRow k="Fiyat" v={formatPrice(detail.level.price, coin.priceDecimals)} />
            <DetailRow k="Seviye hacmi" v={formatCompact(detail.level.qty)} />
            <DetailRow k="Kümülatif derinlik" v={formatCompact(detail.level.total)} />
            <DetailRow k="Taraf" v={detail.side === 'bid' ? 'Alış (destek)' : 'Satış (direnç)'} />
          </div>
        )}
      </Sheet>
    </div>
  )
}

function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-line/60 pb-2">
      <span className="text-muted">{k}</span>
      <span className="font-medium text-text">{v}</span>
    </div>
  )
}
