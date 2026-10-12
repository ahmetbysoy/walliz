import { clsx } from 'clsx'
import { StatusPill } from '@/features/market-feed/ui/StatusPill'
import { CoinSelect } from '@/features/preferences/ui/CoinSelect'
import { TimeframeChips } from '@/features/preferences/ui/TimeframeChips'
import { getCoin } from '@/shared/config/coins'
import { formatPct, formatPrice } from '@/shared/lib/format'
import { loadPreferences, savePreferences } from '@/shared/lib/learningRepo'
import { useMarketStore } from '@/shared/model/marketStore'

export function Header({ onRetry }: { onRetry: () => void }) {
  const status = useMarketStore((s) => s.status)
  const feedError = useMarketStore((s) => s.feedError)
  const symbol = useMarketStore((s) => s.symbol)
  const timeframe = useMarketStore((s) => s.timeframe)
  const price = useMarketStore((s) => s.price)
  const ticker = useMarketStore((s) => s.ticker)
  const coin = getCoin(symbol)

  const changeSymbol = (next: string) => {
    useMarketStore.getState().reset(next, timeframe)
    void loadPreferences().then((p) => savePreferences({ ...p, symbol: next }))
  }
  const changeTf = (next: string) => {
    useMarketStore.getState().reset(symbol, next)
    void loadPreferences().then((p) => savePreferences({ ...p, timeframe: next }))
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 px-3 pb-2 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <StatusPill status={status} error={feedError} onTap={onRetry} />
        <div className="flex items-center gap-2">
          <CoinSelect value={symbol} onChange={changeSymbol} />
          <TimeframeChips value={timeframe} onChange={changeTf} />
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-text">
          {formatPrice(price ?? Number.NaN, coin.priceDecimals)}
        </span>
        <span
          className={clsx(
            'text-sm font-medium tabular-nums',
            (ticker?.changePct ?? 0) >= 0 ? 'text-mint' : 'text-coral',
          )}
        >
          {ticker ? formatPct(ticker.changePct) : '—'}
        </span>
        <span className="ml-auto text-[11px] text-muted">{coin.name}</span>
      </div>
    </header>
  )
}
