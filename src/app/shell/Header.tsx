import { useState } from 'react'
import { clsx } from 'clsx'
import { HelpCircle } from 'lucide-react'
import { StatusPill } from '@/features/market-feed/ui/StatusPill'
import { CoinSelect } from '@/features/preferences/ui/CoinSelect'
import { IntroModal } from '@/features/preferences/ui/IntroModal'
import { getCoin } from '@/shared/config/coins'
import { formatPct, formatPrice } from '@/shared/lib/format'
import { loadPreferences, savePreferences } from '@/shared/lib/learningRepo'
import { useMarketStore } from '@/shared/model/marketStore'
import { Skeleton } from '@/shared/ui/Skeleton'

export function Header({
  onRetry,
  visible = true,
}: {
  onRetry: () => void
  visible?: boolean
}) {
  const [showIntro, setShowIntro] = useState(false)
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

  const isConnecting = status === 'connecting' && price == null

  return (
    <>
      <header
        className={clsx(
          'sticky top-0 z-30 flex h-14 landscape:h-9 min-h-14 landscape:min-h-9 items-center justify-between border-b border-line bg-bg/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur transition-transform duration-200',
          !visible && '-translate-y-full',
        )}
      >
        {/* Sol taraf: Coin seçici + Canlı Fiyat + 24s Değişim (Tek satırda) */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CoinSelect value={symbol} onChange={changeSymbol} />

          <div className="flex min-w-0 items-baseline gap-1.5 overflow-hidden">
            {isConnecting ? (
              <Skeleton className="h-6 landscape:h-5 w-20 rounded-md" />
            ) : (
              <span className="text-[19px] landscape:text-base font-semibold tabular-nums text-text truncate">
                {formatPrice(price ?? Number.NaN, coin.priceDecimals)}
              </span>
            )}

            {ticker ? (
              <span
                className={clsx(
                  'text-xs font-semibold tabular-nums shrink-0',
                  ticker.changePct >= 0 ? 'text-mint' : 'text-coral',
                )}
              >
                {formatPct(ticker.changePct)}
              </span>
            ) : (
              <span className="text-xs text-muted tabular-nums shrink-0">—</span>
            )}
          </div>
        </div>

        {/* Sağ taraf: Tanıtım / Yardım butonu + Feed Durum Noktası */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            aria-label="Rehber ve yardım"
            onClick={() => setShowIntro(true)}
            className="flex size-9 landscape:size-7 min-h-[44px] landscape:min-h-[36px] min-w-[44px] landscape:min-w-[36px] items-center justify-center rounded-lg text-muted hover:text-text transition-colors"
          >
            <HelpCircle className="size-4" aria-hidden />
          </button>
          <StatusPill status={status} error={feedError} onTap={onRetry} />
        </div>
      </header>

      <IntroModal open={showIntro} onOpenChange={setShowIntro} />
    </>
  )
}
