import { BrainCircuit } from 'lucide-react'
import { useLearningStore } from '@/shared/model/learningStore'
import { formatPct, formatTime } from '@/shared/lib/format'
import { Card, CardTitle } from '@/shared/ui/Card'
import { ConfidenceBar } from '@/shared/ui/ConfidenceBar'
import { EmptyState } from '@/shared/ui/EmptyState'
import { SignalOrb } from './SignalOrb'

export function PredictionCard() {
  const pending = useLearningStore((s) => s.state.pending)
  const last = useLearningStore((s) => s.state.recent[0] ?? null)

  if (!pending) {
    return (
      <Card>
        <EmptyState
          icon={BrainCircuit}
          title="Tahmin bekleniyor"
          hint="İlk mum kapanışında model bir yön tahmini üretecek."
          className="border-0 py-6"
        />
      </Card>
    )
  }

  return (
    <Card>
      <CardTitle className="mb-3 flex items-center gap-1.5">
        <BrainCircuit className="size-3.5" aria-hidden /> Model Tahmini
      </CardTitle>
      <div className="flex items-center gap-4">
        <SignalOrb direction={pending.direction} confidence={pending.confidence} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold tabular-nums text-text">
              GÜVEN %{Math.round(pending.confidence * 100)}
            </span>
            <span className="text-[11px] tabular-nums text-muted">{formatTime(pending.at)}</span>
          </div>
          <ConfidenceBar value={pending.confidence} className="mt-1.5" />
          <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted">
            <span>skor {pending.score.toFixed(2)}</span>
            <span>eşik ±{((pending.threshold / pending.basePrice) * 100).toFixed(2)}%</span>
          </div>
        </div>
      </div>
      {last && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-2/60 px-3 py-2 text-xs tabular-nums">
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
    </Card>
  )
}
