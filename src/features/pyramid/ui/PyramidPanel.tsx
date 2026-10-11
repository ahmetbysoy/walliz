import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown, Layers } from 'lucide-react'
import { clsx } from 'clsx'
import type { ConfidenceBand, RecentValidation } from '@/entities'
import { BAND_ORDER, bandFor, hitRate } from '@/shared/lib/buckets'
import { formatPct, formatTime } from '@/shared/lib/format'
import { useLearningStore } from '@/shared/model/learningStore'
import { Card, CardTitle } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'

const BAND_META: Record<ConfidenceBand, { label: string; width: string }> = {
  high: { label: 'Yüksek güven (≥%70)', width: 'w-3/5' },
  medium: { label: 'Orta güven (%40–70)', width: 'w-4/5' },
  low: { label: 'Düşük güven (<%40)', width: 'w-full' },
}

/** Kova sistemi: tahmin doğruluğu güven aralığına göre bucket'lanır (pyramid). */
export function PyramidPanel() {
  const state = useLearningStore((s) => s.state)
  const total = state.stats.total
  if (total === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="Henüz doğrulama yok"
        hint="Model tahmini sonuçlandıkça kovalar dolacak."
      />
    )
  }
  return (
    <Card>
      <CardTitle className="mb-3">Doğruluk Kovaları</CardTitle>
      <div className="flex flex-col items-center gap-1.5">
        {BAND_ORDER.map((band) => (
          <PyramidBucket
            key={band}
            band={band}
            recent={state.recent.filter((r) => bandFor(r.confidence) === band).slice(0, 5)}
          />
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] tabular-nums text-muted">
        Toplam {total} doğrulama · isabet %{Math.round((state.stats.hits / total) * 100)}
      </p>
    </Card>
  )
}

function PyramidBucket({ band, recent }: { band: ConfidenceBand; recent: RecentValidation[] }) {
  const bucket = useLearningStore((s) => s.state.buckets[band])
  const [open, setOpen] = useState(false)
  const meta = BAND_META[band]
  const rate = hitRate(bucket)
  const rateColor =
    bucket.total === 0
      ? 'text-muted'
      : rate >= 0.55
        ? 'text-mint'
        : rate >= 0.4
          ? 'text-amber'
          : 'text-coral'

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className={meta.width}>
      <Collapsible.Trigger
        aria-label={`${meta.label} kovanını aç`}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/70 px-3 py-2.5 text-xs transition-colors hover:bg-surface-2"
      >
        <span className="font-medium text-text">{meta.label}</span>
        <span className="flex items-center gap-2 tabular-nums">
          <span className={rateColor}>{bucket.total ? `%${Math.round(rate * 100)}` : '—'}</span>
          <span className="text-muted">{bucket.total} kez</span>
          <ChevronDown
            className={clsx('size-3.5 text-muted transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </span>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="mt-1.5 rounded-xl border border-line/60 bg-surface-2/40 px-3 py-2 text-[11px]">
          <div className="flex justify-between text-muted">
            <span>
              İsabet {bucket.hits}/{bucket.total}
            </span>
            <span>Seri: {bucket.streak}</span>
          </div>
          {recent.length === 0 ? (
            <p className="mt-1 text-muted/70">Bu kova için henüz kayıt yok.</p>
          ) : (
            <ul className="mt-1.5 flex flex-col gap-1">
              {recent.map((r) => (
                <li key={r.id} className="flex justify-between tabular-nums">
                  <span className="text-muted">{formatTime(r.at)}</span>
                  <span
                    className={
                      r.outcome === 'hit'
                        ? 'text-mint'
                        : r.outcome === 'miss'
                          ? 'text-coral'
                          : 'text-violet'
                    }
                  >
                    {r.outcome === 'hit' ? '✓' : r.outcome === 'miss' ? '✗' : '—'}{' '}
                    {formatPct(r.movePct)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
