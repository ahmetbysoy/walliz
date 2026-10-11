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
import type { Candle, Wall } from '@/entities'
import { getCoin } from '@/shared/config/coins'
import { clamp01 } from '@/shared/lib/math'
import { formatPrice } from '@/shared/lib/format'
import { useMarketStore } from '@/shared/model/marketStore'
import { Skeleton } from '@/shared/ui/Skeleton'

/** lightweight-charts v4 sarmalayıcı: mum + volume + duvar fiyat çizgileri. */

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

export default function CandleChart({ height = 340 }: { height?: number }) {
  const candles = useMarketStore((s) => s.candles)
  const walls = useMarketStore((s) => s.walls)
  const price = useMarketStore((s) => s.price)
  const symbol = useMarketStore((s) => s.symbol)
  const timeframe = useMarketStore((s) => s.timeframe)
  const coin = getCoin(symbol)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const wallLinesRef = useRef(new Map<string, IPriceLine>())
  const lastDataKeyRef = useRef('')
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
    return () => {
      el.removeEventListener('dblclick', onDblClick)
      wallLines.clear()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [])

  // veri: coin/timeframe değişince tam setData, yoksa incremental update
  const dataKey = `${symbol}:${timeframe}`
  useEffect(() => {
    const series = candleSeriesRef.current
    const vol = volumeSeriesRef.current
    if (!series || !vol || candles.length === 0) return
    if (dataKey !== lastDataKeyRef.current) {
      series.setData(candles.map(toChartCandle))
      vol.setData(candles.map(toVolume))
      for (const line of wallLinesRef.current.values()) series.removePriceLine(line)
      wallLinesRef.current.clear()
      lastDataKeyRef.current = dataKey
      if (candles.length < 320) chartRef.current?.timeScale().fitContent()
      return
    }
    const last = candles[candles.length - 1]
    series.update(toChartCandle(last))
    vol.update(toVolume(last))
  }, [candles, dataKey])

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

  return (
    <div className="relative" data-chart-root>
      {candles.length === 0 && <Skeleton className="absolute inset-0 rounded-2xl" />}
      <div
        ref={containerRef}
        style={{ height }}
        className={candles.length === 0 ? 'invisible' : ''}
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
