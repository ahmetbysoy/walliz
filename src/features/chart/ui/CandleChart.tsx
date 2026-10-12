import { useEffect, useRef, useState, useMemo } from 'react'
import {
  ColorType,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { Maximize2, Minimize2, WifiOff } from 'lucide-react'
import type { Candle, FeedStatus, Wall } from '@/entities'
import { getCoin } from '@/shared/config/coins'
import { clamp01 } from '@/shared/lib/math'
import { formatPrice } from '@/shared/lib/format'
import { loadPreferences, savePreferences } from '@/shared/lib/learningRepo'
import { useMarketStore } from '@/shared/model/marketStore'
import { Skeleton } from '@/shared/ui/Skeleton'
import { TimeframeChips } from '@/shared/ui/TimeframeChips'
import { INITIAL_SYNC_STATE, commitChartSync, planChartSync } from '../lib/chartSync'

interface LegendState {
  o: number
  h: number
  l: number
  c: number
  v: number
}

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha.toFixed(2)})`
}

const toChartCandle = (c: Candle) => ({
  time: c.time as UTCTimestamp,
  open: c.open,
  high: c.high,
  low: c.low,
  close: c.close,
})

const toVolume = (c: Candle) => ({
  time: c.time as UTCTimestamp,
  value: c.volume,
  color: c.close >= c.open ? 'rgba(46, 230, 168, 0.35)' : 'rgba(255, 107, 107, 0.35)',
})

const EMPTY_HINT: Record<FeedStatus, string> = {
  connecting: 'Borsa bağlantısı kuruluyor…',
  reconnecting: 'Bağlantı yeniden kuruluyor…',
  live: 'Geçmiş mumlar borsadan alınıyor…',
  offline: 'Canlı veriye ulaşılamıyor — borsa bağlantısı yok.',
}

export default function CandleChart({
  height,
  onRetry,
  onNavigateToWalls,
}: {
  height?: number
  onRetry?: () => void
  onNavigateToWalls?: (wall?: Wall) => void
}) {
  const candles = useMarketStore((s) => s.candles)
  const candlesRewriteSeq = useMarketStore((s) => s.candlesRewriteSeq)
  const walls = useMarketStore((s) => s.walls)
  const price = useMarketStore((s) => s.price)
  const symbol = useMarketStore((s) => s.symbol)
  const timeframe = useMarketStore((s) => s.timeframe)
  const status = useMarketStore((s) => s.status)
  const feedError = useMarketStore((s) => s.feedError)
  const coin = getCoin(symbol)

  const [isFullscreen, setIsFullscreen] = useState(false)
  const chartWrapperRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const wallLinesRef = useRef<Map<string, IPriceLine>>(new Map())
  const syncRef = useRef(INITIAL_SYNC_STATE)
  const [legend, setLegend] = useState<LegendState | null>(null)

  const changeTf = (next: string) => {
    useMarketStore.getState().reset(symbol, next)
    void loadPreferences().then((p) => savePreferences({ ...p, timeframe: next }))
  }

  // T-P1-5: En yakın duvar çipi hesaplama
  const nearestWall = useMemo(() => {
    if (!price || walls.length === 0) return null
    let closest: Wall | null = null
    let minDiff = Infinity
    for (const w of walls) {
      const diff = Math.abs(w.price - price)
      if (diff < minDiff) {
        minDiff = diff
        closest = w
      }
    }
    if (!closest) return null
    const diffPct = (Math.abs(closest.price - price) / price) * 100
    const dirText = closest.price >= price ? 'yukarıda' : 'aşağıda'
    const label =
      closest.side === 'bid'
        ? `▲ Alıcı duvarı ${formatPrice(closest.price, coin.priceDecimals)} · %${diffPct.toFixed(2)} ${dirText}`
        : `▼ Satıcı duvarı ${formatPrice(closest.price, coin.priceDecimals)} · %${diffPct.toFixed(2)} ${dirText}`
    return { wall: closest, label }
  }, [price, walls, coin.priceDecimals])

  // Fullscreen toggle (T-P2-3)
  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev)
  }

  // Chart init
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const mint = cssVar('--mint', '#2ee6a8')
    const coral = cssVar('--coral', '#ff6b6b')
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8b98a9',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(35, 44, 56, 0.5)' },
        horzLines: { color: 'rgba(35, 44, 56, 0.5)' },
      },
      rightPriceScale: { borderColor: '#232c38' },
      timeScale: {
        borderColor: '#232c38',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 7,
      },
      crosshair: {
        mode: 0,
        vertLine: { labelBackgroundColor: '#1a212b' },
        horzLine: { labelBackgroundColor: '#1a212b' },
      },
    })
    const candleSeries = chart.addCandlestickSeries({
      upColor: mint,
      downColor: coral,
      wickUpColor: mint,
      wickDownColor: coral,
      borderVisible: false,
    })
    const volumeSeries = chart.addHistogramSeries({
      priceScaleId: 'vol',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setLegend(null)
        return
      }
      const d = param.seriesData.get(candleSeries) as
        | { open: number; high: number; low: number; close: number }
        | undefined
      const v = param.seriesData.get(volumeSeries) as number | undefined
      if (d) setLegend({ o: d.open, h: d.high, l: d.low, c: d.close, v: v ?? 0 })
    })

    const onDblClick = () => chart.timeScale().fitContent()
    el.addEventListener('dblclick', onDblClick)
    const wallLines = wallLinesRef.current

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries
    syncRef.current = INITIAL_SYNC_STATE
    return () => {
      el.removeEventListener('dblclick', onDblClick)
      wallLines.clear()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      syncRef.current = INITIAL_SYNC_STATE
    }
  }, [])

  // Sync data to chart
  const dataKey = `${symbol}:${timeframe}`
  useEffect(() => {
    const series = candleSeriesRef.current
    const vol = volumeSeriesRef.current
    if (!series || !vol) return
    const prevKey = syncRef.current.key
    const plan = planChartSync(syncRef.current, candles, dataKey, candlesRewriteSeq)
    switch (plan.kind) {
      case 'skip':
        return
      case 'clear': {
        series.setData([])
        vol.setData([])
        for (const line of wallLinesRef.current.values()) series.removePriceLine(line)
        wallLinesRef.current.clear()
        break
      }
      case 'full': {
        series.setData(candles.map(toChartCandle))
        vol.setData(candles.map(toVolume))
        if (prevKey !== dataKey || candles.length < 320) chartRef.current?.timeScale().fitContent()
        break
      }
      case 'tail': {
        series.update(toChartCandle(plan.candle))
        vol.update(toVolume(plan.candle))
        break
      }
    }
    syncRef.current = commitChartSync(syncRef.current, plan, candles, dataKey, candlesRewriteSeq)
  }, [candles, dataKey, candlesRewriteSeq])

  // T-P1-4: Duvar çizgileri — En fazla en güçlü 3 duvar etiketli, kalanlar etiketsiz ince çizgi
  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series) return
    const mint = cssVar('--mint', '#2ee6a8')
    const coral = cssVar('--coral', '#ff6b6b')

    // En güçlü 3 bid ve 3 ask belirle
    const bidWalls = walls.filter((w) => w.side === 'bid').sort((a, b) => b.strength - a.strength)
    const askWalls = walls.filter((w) => w.side === 'ask').sort((a, b) => b.strength - a.strength)
    const topLabeledKeys = new Set<string>([
      ...bidWalls.slice(0, 3).map((w) => `${w.side}:${w.price}`),
      ...askWalls.slice(0, 3).map((w) => `${w.side}:${w.price}`),
    ])

    const seen = new Set<string>()
    for (const w of walls) {
      const key = `${w.side}:${w.price}`
      seen.add(key)
      const isTopLabeled = topLabeledKeys.has(key)
      const alpha = clamp01(0.35 + w.strength * 0.08)
      const color = w.side === 'bid' ? rgba(mint, alpha) : rgba(coral, alpha)
      const strengthText = w.strength.toFixed(1).replace('.', ',')
      const title = isTopLabeled
        ? w.side === 'bid'
          ? `Alıcı duvarı ×${strengthText}`
          : `Satıcı duvarı ×${strengthText}`
        : ''

      const existing = wallLinesRef.current.get(key)
      if (existing) {
        existing.applyOptions({
          color,
          title,
          axisLabelVisible: isTopLabeled,
          lineWidth: isTopLabeled ? 2 : 1,
        })
      } else {
        wallLinesRef.current.set(
          key,
          series.createPriceLine({
            price: w.price,
            color,
            lineWidth: isTopLabeled ? 2 : 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: isTopLabeled,
            title,
          }),
        )
      }
    }
    for (const [key, line] of wallLinesRef.current) {
      if (!seen.has(key)) {
        series.removePriceLine(line)
        wallLinesRef.current.delete(key)
      }
    }
  }, [walls])

  const prevClose = candles.length > 1 ? candles[candles.length - 2].close : (price ?? 0)
  const trendUp = (price ?? 0) >= prevClose
  const ariaLabel = `Mum grafiği ${coin.base} ${timeframe}: son fiyat ${formatPrice(
    price ?? Number.NaN,
    coin.priceDecimals,
  )}, trend ${trendUp ? 'yukarı' : 'aşağı'}`
  const noData = candles.length === 0

  return (
    <div
      ref={chartWrapperRef}
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 flex flex-col bg-bg p-3 pb-[env(safe-area-inset-bottom)]'
          : 'relative flex flex-1 flex-col min-h-0'
      }
      data-chart-root
    >
      {/* T-P0-2: Grafiğin kendi araç çubuğu (36px) */}
      <div className="mb-2 landscape:mb-1 flex items-center justify-between gap-1.5 px-0.5">
        <TimeframeChips value={timeframe} onChange={changeTf} />

        <div className="flex items-center gap-1.5">
          {/* T-P1-5: En yakın duvar çipi */}
          {nearestWall && (
            <button
              type="button"
              onClick={() => onNavigateToWalls?.(nearestWall.wall)}
              aria-label={`En yakın duvar: ${nearestWall.label}. Duvarlar paneline git`}
              className="inline-flex min-h-[36px] landscape:min-h-[28px] items-center rounded-lg border border-line bg-surface-2/70 px-2 py-1 text-[11px] landscape:text-[10px] font-medium text-text hover:border-mint/40 active:scale-95 transition-all truncate max-w-[190px] sm:max-w-[260px]"
            >
              <span className="truncate">{nearestWall.label}</span>
            </button>
          )}

          {/* T-P2-3: Tam ekran butonu */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Tam ekrandan çık' : 'Grafiği tam ekran yap'}
            className="flex size-8 landscape:size-7 min-h-[44px] landscape:min-h-[32px] min-w-[44px] landscape:min-w-[32px] items-center justify-center rounded-lg text-muted hover:text-text active:scale-95 transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="size-4" aria-hidden />
            ) : (
              <Maximize2 className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Grafik Çizim Alanı (T-P0-4: Dinamik Yükseklik flex-1 min-h-[260px]) */}
      <div className="relative flex-1 min-h-[260px] landscape:min-h-[220px] w-full rounded-2xl border border-line bg-surface p-2 landscape:p-1 flex flex-col">
        {noData && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-surface px-6 text-center"
          >
            {status === 'offline' ? (
              <>
                <WifiOff className="size-7 text-coral/80" aria-hidden />
                <p className="text-sm font-medium text-text/85">{EMPTY_HINT.offline}</p>
                {feedError && <p className="max-w-[280px] text-xs text-muted">{feedError}</p>}
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-1 min-h-[44px] rounded-xl border border-line bg-surface-2 px-4 py-2 text-sm text-mint active:scale-95 transition-transform"
                  >
                    Yeniden bağlan
                  </button>
                )}
              </>
            ) : (
              <>
                <Skeleton className="absolute inset-0 rounded-2xl" />
                <p className="relative text-xs text-muted">{EMPTY_HINT[status]}</p>
              </>
            )}
          </div>
        )}

        <div
          ref={containerRef}
          style={height ? { height } : undefined}
          className={`flex-1 w-full min-h-[260px] landscape:min-h-[220px] ${noData ? 'invisible' : ''}`}
          role="img"
          aria-label={ariaLabel}
        />

        {legend && (
          <div className="pointer-events-none absolute left-3 top-2 flex gap-3 text-[11px] tabular-nums text-muted">
            <span>
              O <b className="font-medium text-text">{formatPrice(legend.o, coin.priceDecimals)}</b>
            </span>
            <span>
              H <b className="font-medium text-text">{formatPrice(legend.h, coin.priceDecimals)}</b>
            </span>
            <span>
              L <b className="font-medium text-text">{formatPrice(legend.l, coin.priceDecimals)}</b>
            </span>
            <span>
              C{' '}
              <b className={legend.c >= legend.o ? 'text-mint' : 'text-coral'}>
                {formatPrice(legend.c, coin.priceDecimals)}
              </b>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export type { Candle, Wall }
