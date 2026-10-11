import { useRef, useState } from 'react'
import { Download, RotateCcw, Upload, Brain } from 'lucide-react'
import { toast } from 'sonner'
import { useLearningStore } from '@/shared/model/learningStore'
import { createEmptyLearningState } from '@/shared/lib/learningRepo'
import { FEATURE_KEYS, FEATURE_LABELS, WEIGHTS_VERSION } from '@/shared/lib/model'
import { formatPct, formatTime } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Card, CardTitle } from '@/shared/ui/Card'
import { downloadJSON, parseImport, toExportJSON } from '../lib/transfer'

export function LearningPanel() {
  const state = useLearningStore((s) => s.state)
  const symbol = useLearningStore((s) => s.symbol)
  const replace = useLearningStore((s) => s.replace)
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const total = state.stats.total
  const rate = total > 0 ? (state.stats.hits / total) * 100 : 0

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardTitle className="mb-3 flex items-center gap-1.5">
          <Brain className="size-3.5" aria-hidden /> Ağırlıklar{' '}
          <span className="normal-case text-muted/70">(v{state.weights.version})</span>
        </CardTitle>
        <div className="flex flex-col gap-2.5">
          {FEATURE_KEYS.map((k) => {
            const v = state.weights.values[k]
            const pct = Math.min(100, (Math.abs(v) / 2) * 100)
            return (
              <div key={k}>
                <div className="flex justify-between text-[11px] text-muted">
                  <span>{FEATURE_LABELS[k]}</span>
                  <span className="tabular-nums">{v.toFixed(3)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={
                      v >= 0 ? 'h-full rounded-full bg-mint' : 'h-full rounded-full bg-coral'
                    }
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-2">İstatistik</CardTitle>
        <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
          <Stat label="Toplam" value={String(total)} />
          <Stat
            label="İsabet"
            value={total ? `%${Math.round(rate)}` : '—'}
            tone={rate >= 50 ? 'text-mint' : 'text-coral'}
          />
          <Stat label="Seri" value={String(state.stats.streak)} />
          <Stat label="Rekor" value={String(state.stats.bestStreak)} />
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-2">Son Doğrulamalar</CardTitle>
        {state.recent.length === 0 ? (
          <p className="text-xs text-muted">Henüz sonuçlanan tahmin yok.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {state.recent.slice(0, 10).map((r) => (
              <li key={r.id} className="flex items-center justify-between text-xs tabular-nums">
                <span className="text-muted">{formatTime(r.at)}</span>
                <span className="text-text/80">
                  {r.direction === 'up' ? '↑' : r.direction === 'down' ? '↓' : '—'} %
                  {Math.round(r.confidence * 100)}
                </span>
                <span
                  className={
                    r.outcome === 'hit'
                      ? 'text-mint'
                      : r.outcome === 'miss'
                        ? 'text-coral'
                        : 'text-violet'
                  }
                >
                  {r.outcome === 'hit' ? '✓' : r.outcome === 'miss' ? '✗' : '—'}
                </span>
                <span className={r.movePct >= 0 ? 'text-mint' : 'text-coral'}>
                  {formatPct(r.movePct)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle className="mb-2">Veri</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Öğrenme verisini JSON olarak indir"
            onClick={() => {
              downloadJSON(`lanka-${symbol}-learning.json`, toExportJSON(state, symbol))
              toast.success('Öğrenme verisi dışa aktarıldı')
            }}
          >
            <Download className="size-3.5" aria-hidden /> Dışa aktar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="JSON dosyasından içe aktar"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-3.5" aria-hidden /> İçe aktar
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                const { state: imported } = parseImport(await f.text())
                replace(imported)
                toast.success('Veri içe aktarıldı')
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'İçe aktarma başarısız')
              }
            }}
          />
          {!confirmReset ? (
            <Button
              size="sm"
              variant="danger"
              aria-label="Öğrenme verisini sıfırla"
              onClick={() => setConfirmReset(true)}
            >
              <RotateCcw className="size-3.5" aria-hidden /> Sıfırla
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  replace(createEmptyLearningState())
                  setConfirmReset(false)
                  toast.success('Öğrenme verisi sıfırlandı')
                }}
              >
                Eminim, sıfırla
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                Vazgeç
              </Button>
            </div>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Model v{WEIGHTS_VERSION} · {symbol}
        </p>
      </Card>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-surface-2/60 px-1 py-2">
      <div className={`text-sm font-semibold tabular-nums ${tone ?? 'text-text'}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  )
}
