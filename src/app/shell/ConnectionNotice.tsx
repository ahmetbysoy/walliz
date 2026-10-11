import { clsx } from 'clsx'
import { WifiOff } from 'lucide-react'
import { useMarketStore } from '@/shared/model/marketStore'

/**
 * Bağlantı uyarısı — veri akmadığında uygulamanın neden boş olduğunu açıkça söyler.
 * (Uydurma veri göstermek yerine durumu bildirir ve yeniden deneme sunar.)
 */
export function ConnectionNotice({ onRetry }: { onRetry: () => void }) {
  const status = useMarketStore((s) => s.status)
  const feedError = useMarketStore((s) => s.feedError)
  const hasData = useMarketStore((s) => s.price !== null || s.candles.length > 0)

  if (status === 'live' || (hasData && status !== 'offline')) return null

  const offline = status === 'offline'
  return (
    <div
      role="alert"
      className={clsx(
        'flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs',
        offline
          ? 'border-coral/40 bg-coral/10 text-coral'
          : 'border-amber/40 bg-amber/10 text-amber',
      )}
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {offline ? 'Canlı piyasa verisine ulaşılamıyor' : 'Borsa bağlantısı kuruluyor'}
        </p>
        <p className="truncate text-[11px] opacity-80">
          {feedError ?? 'stream.binance.com bağlantısı bekleniyor'}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-lg border border-current/40 px-2.5 py-1 font-medium"
      >
        Dene
      </button>
    </div>
  )
}
