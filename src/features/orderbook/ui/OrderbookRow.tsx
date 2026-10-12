import { memo } from 'react'
import { Zap } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { BookLevel, WallSide } from '@/entities'
import { formatCompact, formatPrice } from '@/shared/lib/format'
import { useLongPress } from '@/shared/lib/hooks'

export interface OrderbookRowProps {
  level: BookLevel
  side: WallSide
  maxTotal: number
  decimals: number
  isWall: boolean
  onSelect: (level: BookLevel, side: WallSide) => void
}

/** React.memo: 20 satırın her tick'te gereksiz render'ı önlenir. */
export const OrderbookRow = memo(function OrderbookRow({
  level,
  side,
  maxTotal,
  decimals,
  isWall,
  onSelect,
}: OrderbookRowProps) {
  const bind = useLongPress(() => onSelect(level, side))
  const pct = maxTotal > 0 ? Math.min(100, (level.total / maxTotal) * 100) : 0

  return (
    <div
      {...bind}
      onClick={() => onSelect(level, side)}
      role="button"
      tabIndex={0}
      aria-label={`${side === 'bid' ? 'Alış' : 'Satış'} seviyesi: ${formatPrice(level.price, decimals)}, hacim: ${formatCompact(level.qty)}${isWall ? ' (Duvar)' : ''}`}
      className={twMerge(
        clsx(
          'relative flex h-7 select-none cursor-pointer items-center justify-between px-3 text-xs tabular-nums transition-colors hover:bg-surface-2/60 active:bg-surface-2',
          isWall && (side === 'bid' ? 'bg-mint/10 font-medium' : 'bg-coral/10 font-medium'),
        ),
      )}
    >
      <span
        className={clsx(
          'pointer-events-none absolute inset-y-0 right-0 opacity-25',
          side === 'bid' ? 'bg-mint' : 'bg-coral',
        )}
        style={{ width: `${pct}%` }}
        aria-hidden
      />
      <span className={clsx('relative', side === 'bid' ? 'text-mint' : 'text-coral')}>
        {formatPrice(level.price, decimals)}
      </span>
      <span className="relative text-text/80">{formatCompact(level.qty)}</span>
      <span className="relative text-muted">{formatCompact(level.total)}</span>
      {isWall && (
        <span className="relative ml-1 flex items-center gap-0.5 text-[10px] font-bold text-violet">
          <Zap className="size-3" aria-hidden />
          <span className="sr-only">Duvar</span>
        </span>
      )}
    </div>
  )
})
