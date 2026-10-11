/**
 * Backtest: sentetik mum serisi üzerinde modeli çalıştırır.
 * Kullanım: npm run backtest   (SEED=42 için)
 * Not: Sandbox'ta Binance REST'e erişim yoksa sentetik seri kullanılır.
 */
import { gaussian, mulberry32 } from '../src/features/market-feed/lib/demoRng'
import { computeFeatures } from '../src/shared/lib/features'
import { atr } from '../src/shared/lib/math'
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  createInitialWeights,
  learnWith,
  predictWith,
} from '../src/shared/lib/model'
import type { Candle, BookSnapshot, FeatureVector, Wall } from '../src/entities'

const N = Number(process.env.N ?? 3000)
const SEED = Number(process.env.SEED ?? 42)
const ATR_MOVE_FACTOR = 0.35

function syntheticCandles(n: number, rng: () => number): Candle[] {
  const out: Candle[] = []
  let price = 100
  let drift = 0
  const t0 = Math.floor(Date.now() / 1000 / 60) * 60
  for (let i = 0; i < n; i++) {
    if (i % 250 === 0) drift = (rng() - 0.5) * 0.0004
    const open = price
    let high = open
    let low = open
    let close = open
    for (let s = 0; s < 4; s++) {
      close *= Math.exp(gaussian(rng) * 0.0008 + drift / 4)
      high = Math.max(high, close)
      low = Math.min(low, close)
    }
    out.push({ time: t0 + i * 60, open, high, low, close, volume: 1000, closed: true })
    price = close
  }
  return out
}

const emptyBook: BookSnapshot = { bids: [], asks: [], ts: 0 }
const noWalls: Wall[] = []

function main() {
  const rng = mulberry32(SEED)
  const candles = syntheticCandles(N, rng)
  let weights = createInitialWeights().values
  let hits = 0
  let misses = 0
  let neutrals = 0
  const bandStats: Record<string, { total: number; hits: number }> = {
    high: { total: 0, hits: 0 },
    medium: { total: 0, hits: 0 },
    low: { total: 0, hits: 0 },
  }

  const start = 60
  for (let i = start; i < N; i++) {
    const window = candles.slice(Math.max(0, i - 80), i)
    const features: FeatureVector | null = computeFeatures({
      candles: window,
      book: emptyBook,
      walls: noWalls,
    })
    if (!features) continue
    const pred = predictWith(weights, features)
    const atrValue = atr(window, 14) ?? 0
    const threshold = atrValue * ATR_MOVE_FACTOR
    const actual = candles[i].close - candles[i - 1].close
    const movePct = (actual / candles[i - 1].close) * 100

    let kind: 'hit' | 'miss' | 'neutral'
    const absThrPct = threshold / candles[i - 1].close
    if (Math.abs(movePct) / 100 < absThrPct * 0.25) kind = 'neutral'
    else if (pred.direction === 'up') kind = actual > 0 ? 'hit' : 'miss'
    else if (pred.direction === 'down') kind = actual < 0 ? 'hit' : 'miss'
    else kind = 'neutral'

    if (kind === 'neutral') neutrals++
    else if (kind === 'hit') hits++
    else misses++

    const band = pred.confidence >= 0.7 ? 'high' : pred.confidence >= 0.4 ? 'medium' : 'low'
    bandStats[band].total++
    if (kind === 'hit') bandStats[band].hits++

    ;({ values: weights } = learnWith(weights, features, actual, threshold))
  }

  const total = hits + misses + neutrals
  console.log('── LANKA backtest (sentetik) ─────────────────────')
  console.log(`seed=${SEED} mum=${N - start} anlamlı=${hits + misses}`)
  console.log(
    `isabet=${hits} ıskalama=${misses} nötr=${neutrals} → isabet %${
      hits + misses ? ((hits / (hits + misses)) * 100).toFixed(1) : '—'
    } (tüm ${total} tahmin)`,
  )
  for (const [band, s] of Object.entries(bandStats)) {
    const rate = s.total ? ((s.hits / s.total) * 100).toFixed(1) : '—'
    console.log(`  kova ${band.padEnd(6)} ${String(s.total).padStart(5)} tahmin · isabet %${rate}`)
  }
  console.log('son ağırlıklar:')
  for (const k of FEATURE_KEYS)
    console.log(`  ${FEATURE_LABELS[k].padEnd(14)} ${weights[k].toFixed(4)}`)
}

main()
