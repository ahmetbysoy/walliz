import { useState } from 'react'
import { BrainCircuit, ChevronRight, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useLearningStore } from '@/shared/model/learningStore'
import { formatPct, formatTime } from '@/shared/lib/format'
import { ConfidenceBar } from '@/shared/ui/ConfidenceBar'
import { Sheet } from '@/shared/ui/Sheet'
import { SignalOrb } from './SignalOrb'
import { haptic } from '@/shared/lib/haptics'

export function PredictionCard() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const pending = useLearningStore((s) => s.state.pending)
  const stats = useLearningStore((s) => s.state.stats)
  const last = useLearningStore((s) => s.state.recent[0] ?? null)

  const total = stats.total
  const hasEnoughData = total >= 20
  const hitRatePct = total > 0 ? Math.round((stats.hits / total) * 100) : 0

  const handleOpen = () => {
    haptic(10)
    setSheetOpen(true)
  }

  // Tahmin yokken kompakt tek satır (T-P0-5)
  if (!pending) {
    return (
      <>
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Model tahmini: İlk mum kapanışında tahmin üretilecek. Detaylar için dokunun."
          className="flex h-10 w-full min-h-[44px] items-center justify-between rounded-xl border border-line bg-surface px-3 text-xs text-muted hover:border-mint/30 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-2">
            <BrainCircuit className="size-4 text-muted/80" aria-hidden />
            <span className="text-text/80">İlk mum kapanışında tahmin üretilecek</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted">
            {last && (
              <span className="flex items-center gap-1">
                <span>Son sonuç</span>
                <span className={last.outcome === 'hit' ? 'text-mint' : last.outcome === 'miss' ? 'text-coral' : 'text-violet'}>
                  {last.outcome === 'hit' ? '✓ isabet' : last.outcome === 'miss' ? '✗ ıskaladı' : '— nötr'}
                </span>
              </span>
            )}
            <span>{hasEnoughData ? `İsabet: %${hitRatePct}` : 'Model hazır'}</span>
          </div>
        </button>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Model Tahmin Detayı">
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-line bg-surface-2/60 p-4 text-center">
              <BrainCircuit className="mx-auto mb-2 size-8 text-muted" aria-hidden />
              <h3 className="text-sm font-semibold text-text">Tahmin Bekleniyor</h3>
              <p className="mt-1 text-xs text-muted">
                Model, ilk mum tamamlandığında piyasa dengesizliği ve duvar baskısına göre yön
                tahmini üretecek.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-surface-2/40 p-3">
              <div className="text-xs font-medium text-text mb-2">Geçmiş Doğruluk İstatistiği</div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs tabular-nums">
                <div className="rounded-lg bg-surface p-2">
                  <div className="text-text font-semibold">{total}</div>
                  <div className="text-[10px] text-muted">Toplam</div>
                </div>
                <div className="rounded-lg bg-surface p-2">
                  <div className={hasEnoughData && hitRatePct >= 50 ? 'text-mint font-semibold' : 'text-text font-semibold'}>
                    {hasEnoughData ? `%${hitRatePct}` : '—'}
                  </div>
                  <div className="text-[10px] text-muted">
                    {hasEnoughData ? 'İsabet' : '<20 veri'}
                  </div>
                </div>
                <div className="rounded-lg bg-surface p-2">
                  <div className="text-text font-semibold">{stats.streak}</div>
                  <div className="text-[10px] text-muted">Seri</div>
                </div>
              </div>
            </div>

            {last && (
              <div className="flex items-center justify-between rounded-xl bg-surface-2/80 px-3 py-2.5 text-xs tabular-nums">
                <span className="text-muted">Son sonuç</span>
                <span
                  className={
                    last.outcome === 'hit'
                      ? 'text-mint'
                      : last.outcome === 'miss'
                        ? 'text-coral'
                        : 'text-violet'
                  }
                >
                  {last.outcome === 'hit'
                    ? '✓ isabet'
                    : last.outcome === 'miss'
                      ? '✗ ıskaladı'
                      : '— nötr'}{' '}
                  · {formatPct(last.movePct)}
                </span>
              </div>
            )}
          </div>
        </Sheet>
      </>
    )
  }

  // Tahmin varken tek satırlık interaktif şerit (T-P0-5)
  const isUp = pending.direction === 'up'
  const isDown = pending.direction === 'down'
  const dirLabel = isUp ? 'YUKARI' : isDown ? 'AŞAĞI' : 'YATAY'
  const dirColor = isUp ? 'text-mint' : isDown ? 'text-coral' : 'text-violet'
  const dirBg = isUp ? 'bg-mint/15 border-mint/30' : isDown ? 'bg-coral/15 border-coral/30' : 'bg-violet/15 border-violet/30'
  const signalPct = Math.round(pending.confidence * 100)

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Model tahmini: ${dirLabel}, Sinyal gücü %${signalPct}. Detaylar için dokunun.`}
        className="flex h-10 w-full min-h-[44px] items-center justify-between rounded-xl border border-line bg-surface px-3 text-xs hover:border-mint/40 active:scale-[0.99] transition-all"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted/90">Model Tahmini</span>
          <span
            className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${dirBg} ${dirColor}`}
          >
            {isUp ? (
              <TrendingUp className="size-3" aria-hidden />
            ) : isDown ? (
              <TrendingDown className="size-3" aria-hidden />
            ) : (
              <Minus className="size-3" aria-hidden />
            )}
            {dirLabel}
          </span>
          <span className="font-medium text-text">Sinyal gücü %{signalPct}</span>
        </div>

        <div className="flex items-center gap-2 text-muted tabular-nums">
          {last && (
            <span className="flex items-center gap-1">
              <span>Son sonuç</span>
              <span className={last.outcome === 'hit' ? 'text-mint text-[11px]' : last.outcome === 'miss' ? 'text-coral text-[11px]' : 'text-violet text-[11px]'}>
                {last.outcome === 'hit' ? '✓ isabet' : last.outcome === 'miss' ? '✗ ıskaladı' : '— nötr'}
              </span>
            </span>
          )}
          <span className="text-[11px]">
            {hasEnoughData ? `İsabet: %${hitRatePct}` : '(yeterli veri yok)'}
          </span>
          <ChevronRight className="size-4 text-muted/70" aria-hidden />
        </div>
      </button>

      {/* Dokununca açılan tam model detay kartı (Bottom Sheet) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Model Tahmini & Sinyal Analizi">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface-2/60 p-4">
            <SignalOrb direction={pending.direction} confidence={pending.confidence} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold tabular-nums text-text">
                  SİNYAL GÜCÜ %{signalPct}
                </span>
                <span className="text-[11px] tabular-nums text-muted">{formatTime(pending.at)}</span>
              </div>
              <ConfidenceBar value={pending.confidence} className="mt-1.5" />
              <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted">
                <span>Skor: {pending.score.toFixed(2)}</span>
                <span>Eşik: ±{((pending.threshold / pending.basePrice) * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface-2/40 p-3">
            <div className="text-xs font-medium text-text mb-2">Model Doğruluk Kanıtı</div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs tabular-nums">
              <div className="rounded-lg bg-surface p-2">
                <div className="text-text font-semibold">{total}</div>
                <div className="text-[10px] text-muted">Toplam Tahmin</div>
              </div>
              <div className="rounded-lg bg-surface p-2">
                <div className={hasEnoughData && hitRatePct >= 50 ? 'text-mint font-semibold' : 'text-text font-semibold'}>
                  {hasEnoughData ? `%${hitRatePct}` : '—'}
                </div>
                <div className="text-[10px] text-muted">
                  {hasEnoughData ? 'Gerçek İsabet' : 'henüz <20 veri'}
                </div>
              </div>
              <div className="rounded-lg bg-surface p-2">
                <div className="text-text font-semibold">{stats.streak}</div>
                <div className="text-[10px] text-muted">Mevcut Seri</div>
              </div>
            </div>
          </div>

          {last && (
            <div className="flex items-center justify-between rounded-xl bg-surface-2/80 px-3 py-2.5 text-xs tabular-nums">
              <span className="text-muted">Son sonuç</span>
              <span
                className={
                  last.outcome === 'hit'
                    ? 'text-mint'
                    : last.outcome === 'miss'
                      ? 'text-coral'
                      : 'text-violet'
                }
              >
                {last.outcome === 'hit'
                  ? '✓ isabet'
                  : last.outcome === 'miss'
                    ? '✗ ıskaladı'
                    : '— nötr'}{' '}
                · {formatPct(last.movePct)}
              </span>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  )
}
