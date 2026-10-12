import { Suspense, lazy, useEffect, useRef, useState, useCallback } from 'react'
import { useDrag } from '@use-gesture/react'
import { RefreshCw } from 'lucide-react'
import { OrderbookPanel } from '@/features/orderbook/ui/OrderbookPanel'
import { PredictionCard } from '@/features/prediction/ui/PredictionCard'
import { loadPreferences } from '@/shared/lib/learningRepo'
import { haptic, setHapticsEnabled } from '@/shared/lib/haptics'
import { useLearningStore } from '@/shared/model/learningStore'
import { useMarketStore } from '@/shared/model/marketStore'
import { Skeleton } from '@/shared/ui/Skeleton'
import { BottomNav } from './shell/BottomNav'
import { ConnectionNotice } from './shell/ConnectionNotice'
import { nextTab, type TabId } from './shell/tabs'
import { Header } from './shell/Header'
import { MetricsRow } from './shell/MetricsRow'
import { ModelPanel } from './shell/ModelPanel'
import { useFeed } from './shell/useFeed'
import { usePrediction } from './shell/usePrediction'
import { useWallEngine } from './shell/useWallEngine'
import { useWallAlerts } from './shell/useWallAlerts'

const CandleChart = lazy(() => import('@/features/chart/ui/CandleChart'))

export function App() {
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<TabId>('grafik')
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)
  const mainRef = useRef<HTMLElement | null>(null)
  const pullRef = useRef(0)
  const lastScrollTopRef = useRef(0)

  const { restart, retry } = useFeed(ready)
  useWallEngine(ready)
  usePrediction(ready)
  useWallAlerts(ready)

  // Tercihleri yükle (ilk feed'den ÖNCE)
  useEffect(() => {
    let cancelled = false
    void loadPreferences().then((p) => {
      if (cancelled) return
      const st = useMarketStore.getState()
      st.reset(p.symbol, p.timeframe)
      if (p.colorblind) document.documentElement.dataset.colorblind = 'on'
      if (p.theme === 'light') document.documentElement.dataset.theme = 'light'
      if (p.haptics != null) setHapticsEnabled(p.haptics)
      void useLearningStore.getState().load(p.symbol)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Sembol değişince o sembolün öğrenme verisini yükle
  const symbol = useMarketStore((s) => s.symbol)
  useEffect(() => {
    if (ready) void useLearningStore.getState().load(symbol)
  }, [ready, symbol])

  // T-P0-6: Kaydırmada Header gizle / göster
  const handleScroll = useCallback(() => {
    const el = mainRef.current
    if (!el) return
    const currentScrollTop = el.scrollTop
    if (currentScrollTop <= 15) {
      setHeaderVisible(true)
    } else if (currentScrollTop > lastScrollTopRef.current + 10 && currentScrollTop > 40) {
      // Aşağı kaydırılıyor
      setHeaderVisible(false)
    } else if (currentScrollTop < lastScrollTopRef.current - 10) {
      // Yukarı kaydırılıyor
      setHeaderVisible(true)
    }
    lastScrollTopRef.current = currentScrollTop
  }, [])

  // T-P3-1: Tek jest bağlamı — grafikle ve yatay kaydırılabilir şeritlerle çakışma engellenir
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
      filter: (e: Event) =>
        !(e.target as HTMLElement | null)?.closest?.(
          '[data-chart-root], [data-no-swipe], .overflow-x-auto, [role="tablist"]',
        ),
    },
  )

  const navigateToWalls = () => {
    setTab('duvarlar')
    haptic(10)
  }

  return (
    <div
      className="mx-auto flex h-dvh max-w-md flex-col bg-bg text-text sm:max-w-lg"
      {...bindGestures}
    >
      <Header onRetry={retry} visible={headerVisible} />

      {pull > 0 && (
        <div className="flex justify-center text-muted" style={{ height: pull / 3 }} aria-hidden>
          <RefreshCw className="size-5" style={{ transform: `rotate(${pull * 4}deg)` }} />
        </div>
      )}

      <main
        ref={mainRef}
        onScroll={handleScroll}
        className="flex flex-1 flex-col overflow-y-auto px-3 landscape:px-2 pb-20 landscape:pb-12 pt-1.5 landscape:pt-0.5"
      >
        {refreshing && (
          <div className="flex justify-center py-1" role="status" aria-label="Yenileniyor">
            <RefreshCw className="size-4 animate-spin text-mint" />
          </div>
        )}
        {ready && (
          <div className="mb-1 empty:hidden">
            <ConnectionNotice onRetry={retry} />
          </div>
        )}

        {!ready ? (
          <div className="flex flex-1 flex-col gap-3 pt-2" aria-busy="true">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="flex-1 min-h-[260px] w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col min-h-0">
            {/* T-P1-2: Sadece aktif olan paneli render / mount et */}
            {tab === 'grafik' && (
              <section
                id="panel-grafik"
                aria-label="Grafik"
                className="flex flex-1 flex-col min-h-0 gap-2"
              >
                {/* T-P0-3: Tek satırlık stat şeridi (≤ 28px) */}
                <MetricsRow />

                {/* T-P0-4: Dinamik Grafik Alanı */}
                <Suspense fallback={<Skeleton className="flex-1 min-h-[260px] w-full rounded-2xl" />}>
                  <CandleChart onRetry={retry} onNavigateToWalls={navigateToWalls} />
                </Suspense>

                {/* T-P0-5: Tek satırlık tahmin şeridi */}
                <PredictionCard />
              </section>
            )}

            {tab === 'duvarlar' && (
              <section id="panel-duvarlar" aria-label="Duvarlar" className="flex flex-col gap-3">
                <OrderbookPanel />
              </section>
            )}

            {tab === 'model' && (
              <section id="panel-model" aria-label="Model" className="flex flex-col gap-3">
                <ModelPanel />
              </section>
            )}
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
