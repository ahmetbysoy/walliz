import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { RefreshCw } from 'lucide-react'
import { OrderbookPanel } from '@/features/orderbook/ui/OrderbookPanel'
import { PyramidPanel } from '@/features/pyramid/ui/PyramidPanel'
import { LearningPanel } from '@/features/learning-memory/ui/LearningPanel'
import { PredictionCard } from '@/features/prediction/ui/PredictionCard'
import { loadPreferences } from '@/shared/lib/learningRepo'
import { haptic } from '@/shared/lib/haptics'
import { useLearningStore } from '@/shared/model/learningStore'
import { useMarketStore } from '@/shared/model/marketStore'
import { Skeleton } from '@/shared/ui/Skeleton'
import { BottomNav } from './shell/BottomNav'
import { nextTab, type TabId } from './shell/tabs'
import { Header } from './shell/Header'
import { MetricsRow } from './shell/MetricsRow'
import { useFeed } from './shell/useFeed'
import { usePrediction } from './shell/usePrediction'
import { useWallEngine } from './shell/useWallEngine'

const CandleChart = lazy(() => import('@/features/chart/ui/CandleChart'))

export function App() {
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<TabId>('grafik')
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const mainRef = useRef<HTMLElement | null>(null)
  const pullRef = useRef(0)

  const { restart, forceLive } = useFeed(ready)
  useWallEngine(ready)
  usePrediction(ready)

  // tercihleri yükle (ilk feed'den ÖNCE)
  useEffect(() => {
    let cancelled = false
    void loadPreferences().then((p) => {
      if (cancelled) return
      const st = useMarketStore.getState()
      st.reset(p.symbol, p.timeframe)
      if (p.colorblind) document.documentElement.dataset.colorblind = 'on'
      void useLearningStore.getState().load(p.symbol)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // sembol değişince o sembolün öğrenme verisini yükle
  const symbol = useMarketStore((s) => s.symbol)
  useEffect(() => {
    if (ready) void useLearningStore.getState().load(symbol)
  }, [ready, symbol])

  // tek gestür bağlamı: yatay swipe → tab geçişi, üstteyken aşağı çek → pull-to-refresh
  const bindGestures = useDrag(
    ({ offset: [dx, y], last }) => {
      const el = mainRef.current
      const atTop = el ? el.scrollTop <= 0 : true
      if (!last) {
        if (y > 0 && atTop && !refreshing) {
          const p = Math.min(90, y * 0.4)
          pullRef.current = p
          setPull(p)
        } else if (pullRef.current !== 0) {
          pullRef.current = 0
          setPull(0)
        }
      } else {
        if (Math.abs(dx) > 60 && Math.abs(y) < 40) {
          setTab((t) => nextTab(t, dx > 0 ? -1 : 1))
          haptic(10)
        }
        if (pullRef.current > 60 && !refreshing) {
          setRefreshing(true)
          haptic(20)
          restart()
          window.setTimeout(() => setRefreshing(false), 1000)
        }
        pullRef.current = 0
        setPull(0)
      }
    },
    {
      pointer: { touch: true },
      filter: (e: Event) => !(e.target as HTMLElement | null)?.closest?.('[data-chart-root]'),
    },
  )

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg text-text sm:max-w-lg"
      {...bindGestures}
    >
      <Header forceLive={forceLive} />

      {pull > 0 && (
        <div className="flex justify-center text-muted" style={{ height: pull / 3 }} aria-hidden>
          <RefreshCw className="size-5" style={{ transform: `rotate(${pull * 4}deg)` }} />
        </div>
      )}

      <main ref={mainRef} className="flex-1 overflow-y-auto px-3 pb-24 pt-2">
        {refreshing && (
          <div className="flex justify-center py-1" role="status" aria-label="Yenileniyor">
            <RefreshCw className="size-4 animate-spin text-mint" />
          </div>
        )}
        {!ready ? (
          <div className="flex flex-col gap-3 pt-2" aria-busy="true">
            <Skeleton className="h-28" />
            <Skeleton className="h-64" />
            <Skeleton className="h-28" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <section
              id="panel-grafik"
              aria-label="Grafik"
              className={tab === 'grafik' ? '' : 'hidden'}
            >
              <div className="flex flex-col gap-3">
                <MetricsRow />
                <div className="rounded-2xl border border-line bg-surface p-2">
                  <Suspense fallback={<Skeleton className="h-[340px]" />}>
                    <CandleChart />
                  </Suspense>
                </div>
                <PredictionCard />
              </div>
            </section>
            <section
              id="panel-duvarlar"
              aria-label="Duvarlar"
              className={tab === 'duvarlar' ? '' : 'hidden'}
            >
              <OrderbookPanel />
            </section>
            <section
              id="panel-kovalar"
              aria-label="Kovalar"
              className={tab === 'kovalar' ? '' : 'hidden'}
            >
              <PyramidPanel />
            </section>
            <section
              id="panel-hafiza"
              aria-label="Hafıza"
              className={tab === 'hafiza' ? '' : 'hidden'}
            >
              <LearningPanel />
            </section>
          </div>
        )}
      </main>

      <BottomNav
        tab={tab}
        onChange={(t) => {
          setTab(t)
          haptic(10)
        }}
      />
    </div>
  )
}
