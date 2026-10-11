import { useEffect, useRef, useState } from 'react'
import {
  ColorType,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { WifiOff } from 'lucide-react'
import type { Candle, FeedStatus, Wall } from '@/entities'
import { getCoin } from '@/shared/config/coins'
import { clamp01 } from '@/shared/lib/math'
import { formatPrice } from '@/shared/lib/format'
import { useMarketStore } from '@/shared/model/marketStore'
import { Skeleton } from '@/shared/ui/Skeleton'
import { INITIAL_SYNC_STATE, commitChartSync, planChartSync } from '../lib/chartSync'

/**
 * lightweight-charts v4 sarmalayıcı: mum + volume + duvar fiyat çizgileri.
 *
 * Çizim stratejisi (gerçek feed'e göre):
 * - Veri kaynağı (symbol/timeframe) değiştiyse, pencere yapısı değiştiyse veya
 *   zaman geriye sarıyorsa `setData()` ile tam çizim.
 * - Aksi halde yalnızca son mum `update()` ile güncellenir.
 * - Seriye hiçbir zaman eski zamanlı `update()` gönderilmez; bu yüzden
 *   "Cannot update oldest data" hatası oluşamaz (bkz. lib/chartSync.ts).
 * - Veri yokken uydurma mum çizilmez: bağlantı durumu açıkça gösterilir.
 */

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
  height = 340,
  onRetry,
}: {
  height?: number
  onRetry?: () => void
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

  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const wallLinesRef = useRef(new Map<string, IPriceLine>())
  const syncRef = useRef(INITIAL_SYNC_STATE)
  const [legend, setLegend] = useState<LegendState | null>(null)

  // chart init (bir kez)
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
        { open: number; high: number; low: number; close: number } | undefined
      const v = param.seriesData.get(volumeSeries) as number | undefined
      if (d) setLegend({ o: d.open, h: d.high, l: d.low, c: d.close, v: v ?? 0 })
    })

    const onDblClick = () => chart.timeScale().fitContent()
    el.addEventListener('dblclick', onDblClick)
    const wallLines = wallLinesRef.current

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries
    // çizim geçmişi bu grafik örneğine bağlı: yeniden kurulumda sıfırlanmalı
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

  // veri: plan çıkar → setData/update/clear uygula → planı commit et
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
        // kaynak değişti veya pencere kısa → görünümü veriye sığdır
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

  // duvar fiyat çizgileri (güç → opaklık)
  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series) return
    const mint = cssVar('--mint', '#2ee6a8')
    const coral = cssVar('--coral', '#ff6b6b')
    const seen = new Set<string>()
    for (const w of walls) {
      const key = `${w.side}:${w.price}`
      seen.add(key)
      const alpha = clamp01(0.35 + w.strength * 0.08)
      const color = w.side === 'bid' ? rgba(mint, alpha) : rgba(coral, alpha)
      const title = `${w.side === 'bid' ? '▲' : '▼'} ${w.strength.toFixed(1)}×`
      const existing = wallLinesRef.current.get(key)
      if (existing) {
        existing.applyOptions({ color, title })
      } else {
        wallLinesRef.current.set(
          key,
          series.createPriceLine({
            price: w.price,
            color,
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
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
    <div className="relative" data-chart-root>
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
                  className="mt-1 rounded-xl border border-line bg-surface-2 px-4 py-2 text-sm text-mint"
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
        style={{ height }}
        className={noData ? 'invisible' : ''}
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
  )
}

export type { Candle, Wall }
