/**
 * Backtest — GERÇEK borsa verisiyle (Binance `/api/v3/klines`).
 *
 * Kullanım:
 *   npm run backtest                                   → BTCUSDT 1m, 3000 mum
 *   SYMBOL=ETHUSDT INTERVAL=5m N=10000 npm run backtest
 *   SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT npm run backtest   → çok sembollü tarama
 *   KLINES_FILE=/veri/btcusdt-1m.json npm run backtest → indirilmiş gerçek kline dosyası
 *   REPORT_JSON=rapor.json npm run backtest            → makine okunur JSON raporu (CI artifact'i)
 *
 * Önemli — veri kaynağı:
 * - Simülasyon/sentetik seri ÜRETİLMEZ. Veri yoksa script hata verip çıkar (exit 1).
 * - Binance public API geçmiş orderbook derinliği yayınlamaz. Bu yüzden kitap türevi
 *   iki feature (imbalance, wallPressure) geçmişte yeniden oynatılamaz; backtest bu
 *   iki feature'ı ABLASYONLA devre dışı bırakır (ağırlıkları her adımda 0) ve
 *   yalnızca fiyat türevi feature'larla (momentum, trend, volatility) ölçüm yapar.
 *   Bu, modelin kitap verisi olmadan ne yaptığını dürüstçe ölçer.
 */
import { writeFileSync } from 'node:fs'
import type { Candle, FeatureKey, FeatureVector } from '../src/entities'
import { computePriceFeatures } from '../src/shared/lib/features'
import { klineUrl, parseKlineRows } from '../src/shared/lib/klines'
import { atr } from '../src/shared/lib/math'
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  createInitialWeights,
  learnWith,
  predictWith,
} from '../src/shared/lib/model'

const SYMBOL = process.env.SYMBOL ?? 'BTCUSDT'
const SYMBOLS = (process.env.SYMBOLS ?? SYMBOL)
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean)
const INTERVAL = process.env.INTERVAL ?? '1m'
const N = Number(process.env.N ?? 3000)
const KLINES_FILE = process.env.KLINES_FILE ?? ''
const REPORT_JSON = process.env.REPORT_JSON ?? ''
const REST_HOSTS = (
  process.env.REST_HOSTS ?? 'https://api.binance.com,https://data-api.binance.vision'
)
  .split(',')
  .map((h) => h.trim().replace(/\/+$/, ''))
  .filter(Boolean)

const ATR_MOVE_FACTOR = 0.35
const FEATURE_PERIOD = 14
/** Model penceresi: karar için kullanılan geçmiş mum sayısı */
const WINDOW = 80
/** Isınma: ilk bu kadar mumdan sonra ölçüm başlar */
const WARMUP = 60
const PAGE_LIMIT = 1000

/** Kitap türevi feature'lar — geçmiş veride yok, ablasyonla kapatılır. */
const BOOK_FEATURES: FeatureKey[] = ['imbalance', 'wallPressure']

/** Isınma sonrası ölçülen mum sayısı */
export const MEASURED_AFTER_WARMUP = Math.max(WARMUP, WINDOW)

export interface BandStat {
  total: number
  hits: number
}

export interface BacktestReport {
  symbol: string
  interval: string
  candles: number
  from: string
  to: string
  lastPrice: number
  /** Ölçülen karar sayısı (isabet + ıskalama) */
  decisions: number
  hits: number
  misses: number
  neutrals: number
  /** isabet / karar */
  hitRate: number
  bands: Record<string, BandStat & { hitRate: number }>
  weights: Record<string, number>
  skipped: number
}

export interface BacktestBundle {
  source: string
  generatedAt: string
  interval: string
  ablation: string[]
  reports: BacktestReport[]
  errors: { symbol: string; message: string }[]
}

const iso = (sec: number): string =>
  new Date(sec * 1000).toISOString().replace('T', ' ').slice(0, 19)

// ─────────────────────────── gerçek veri çekimi ───────────────────────────

async function requestPage(
  host: string,
  symbol: string,
  limit: number,
  endTimeMs: number | undefined,
): Promise<unknown[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(klineUrl(host, symbol, INTERVAL, limit, endTimeMs), {
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as unknown
    if (!Array.isArray(json)) throw new Error('yanıt dizi değil')
    return json
  } finally {
    clearTimeout(timer)
  }
}

/** Sayfalanmış gerçek kline çekimi (en yeniden geriye doğru, sonra kronolojik sıralama). */
async function fetchRealKlines(symbol: string): Promise<Candle[]> {
  const collected = new Map<number, Candle>()
  let endTimeMs: number | undefined = Date.now()
  let hostIndex = 0

  while (collected.size < N) {
    const limit = Math.min(PAGE_LIMIT, N - collected.size)
    let page: Candle[] | null = null
    let lastError = ''
    for (let i = 0; i < REST_HOSTS.length; i++) {
      const host = REST_HOSTS[(hostIndex + i) % REST_HOSTS.length]
      try {
        const rows = await requestPage(host, symbol, limit, endTimeMs)
        const parsed = parseKlineRows(rows, Date.now())
        if (parsed.length === 0) throw new Error('boş/geçersiz sayfa')
        hostIndex = (hostIndex + i) % REST_HOSTS.length
        page = parsed
        break
      } catch (err) {
        lastError = `${host}: ${err instanceof Error ? err.message : String(err)}`
      }
    }
    if (!page) {
      throw new Error(`gerçek kline verisi alınamadı (${lastError || 'bilinmeyen hata'})`)
    }
    for (const c of page) collected.set(c.time, c)
    endTimeMs = page[0].time * 1000 - 1
    process.stdout.write(`\r  ${symbol}: çekilen mum ${collected.size}/${N}`)
    if (page.length < limit) break
  }
  process.stdout.write('\n')
  return [...collected.values()].sort((a, b) => a.time - b.time)
}

/** İndirilmiş gerçek kline dosyası (JSON dizi veya satır başına JSON). */
async function readKlinesFile(path: string): Promise<Candle[]> {
  const { readFileSync } = await import('node:fs')
  const raw = readFileSync(path, 'utf8')
  const rows: unknown[] = []
  if (raw.trimStart().startsWith('[')) {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) rows.push(...parsed)
  } else {
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (t) rows.push(JSON.parse(t) as unknown)
    }
  }
  return parseKlineRows(rows, Date.now())
}

// ─────────────────────────── model koşusu ───────────────────────────

export function runBacktest(symbol: string, candles: Candle[]): BacktestReport {
  let weights = createInitialWeights().values
  let hits = 0
  let misses = 0
  let neutrals = 0
  let skipped = 0
  const bandStats: Record<string, BandStat> = {
    high: { total: 0, hits: 0 },
    medium: { total: 0, hits: 0 },
    low: { total: 0, hits: 0 },
  }

  for (let i = MEASURED_AFTER_WARMUP; i < candles.length; i++) {
    const window = candles.slice(i - WINDOW, i)
    const priceFeatures = computePriceFeatures({ candles: window, atrPeriod: FEATURE_PERIOD })
    const atrValue = atr(window, FEATURE_PERIOD)
    if (!priceFeatures || atrValue == null || atrValue <= 0) {
      skipped++
      continue
    }
    const features: FeatureVector = {
      ...priceFeatures,
      // ablasyon: bu iki feature geçmişte gözlenemez, nötr bırakılır ve ağırlıkları 0'lanır
      imbalance: 0,
      wallPressure: 0,
    }
    const pred = predictWith(weights, features)
    const threshold = atrValue * ATR_MOVE_FACTOR
    const actual = candles[i].close - candles[i - 1].close
    const movePct = (actual / candles[i - 1].close) * 100

    let kind: 'hit' | 'miss' | 'neutral'
    const absThresholdPct = threshold / candles[i - 1].close
    if (Math.abs(movePct) / 100 < absThresholdPct * 0.25) kind = 'neutral'
    else if (pred.direction === 'up') kind = actual > 0 ? 'hit' : 'miss'
    else if (pred.direction === 'down') kind = actual < 0 ? 'hit' : 'miss'
    else kind = 'neutral'

    if (kind === 'neutral') neutrals++
    else if (kind === 'hit') hits++
    else misses++

    const band = pred.confidence >= 0.7 ? 'high' : pred.confidence >= 0.4 ? 'medium' : 'low'
    bandStats[band].total++
    if (kind === 'hit') bandStats[band].hits++

    const learned = learnWith(weights, features, actual, threshold)
    weights = { ...learned.values }
    for (const k of BOOK_FEATURES) weights[k] = 0
  }

  const decisions = hits + misses
  const bands: BacktestReport['bands'] = {}
  for (const [band, s] of Object.entries(bandStats)) {
    bands[band] = { ...s, hitRate: s.total > 0 ? s.hits / s.total : 0 }
  }

  const first = candles[0]
  const last = candles[candles.length - 1]
  const weightsOut: Record<string, number> = {}
  for (const k of FEATURE_KEYS) weightsOut[k] = weights[k]

  return {
    symbol,
    interval: INTERVAL,
    candles: candles.length,
    from: first ? iso(first.time) : '',
    to: last ? iso(last.time) : '',
    lastPrice: last ? last.close : 0,
    decisions,
    hits,
    misses,
    neutrals,
    hitRate: decisions > 0 ? hits / decisions : 0,
    bands,
    weights: weightsOut,
    skipped,
  }
}

function printReport(r: BacktestReport): void {
  console.log('')
  console.log(`── ${r.symbol} ${r.interval} ─────────────────────────────`)
  console.log(`mum          : ${r.candles} adet · ${r.from} → ${r.to}`)
  console.log(`son fiyat    : ${r.lastPrice}`)
  console.log(`ölçülen mum  : ${r.candles - MEASURED_AFTER_WARMUP} (atlanan: ${r.skipped})`)
  console.log(
    `sonuç        : isabet=${r.hits} ıskalama=${r.misses} nötr=${r.neutrals} → isabet %${
      r.decisions ? (r.hitRate * 100).toFixed(1) : '—'
    } (${r.decisions} karar)`,
  )
  for (const [band, s] of Object.entries(r.bands)) {
    console.log(
      `  kova ${band.padEnd(6)} ${String(s.total).padStart(5)} tahmin · isabet %${
        s.total ? (s.hitRate * 100).toFixed(1) : '—'
      }`,
    )
  }
  console.log('son ağırlıklar (ablasyon uygulanmış):')
  for (const k of FEATURE_KEYS)
    console.log(`  ${FEATURE_LABELS[k].padEnd(14)} ${(r.weights[k] ?? 0).toFixed(4)}`)
}

async function main(): Promise<void> {
  console.log('── LANKA backtest — GERÇEK piyasa verisi ─────────')
  const t0 = Date.now()
  const source = KLINES_FILE ? `dosya:${KLINES_FILE}` : REST_HOSTS.join(',')
  console.log(`kaynak       : ${source}`)
  console.log(`semboller    : ${KLINES_FILE ? SYMBOL : SYMBOLS.join(', ')} · aralık: ${INTERVAL}`)
  console.log(
    `ablasyon     : ${BOOK_FEATURES.map((k) => FEATURE_LABELS[k]).join(', ')} devre dışı (geçmiş orderbook derinliği public API'de yok)`,
  )

  const reports: BacktestReport[] = []
  const errors: BacktestBundle['errors'] = []
  const targets = KLINES_FILE ? [SYMBOL] : SYMBOLS

  for (const symbol of targets) {
    try {
      const candles = KLINES_FILE
        ? await readKlinesFile(KLINES_FILE)
        : await fetchRealKlines(symbol)
      if (candles.length < MEASURED_AFTER_WARMUP + 10) {
        throw new Error(`yeterli gerçek veri yok (${candles.length} mum)`)
      }
      const report = runBacktest(symbol, candles)
      reports.push(report)
      printReport(report)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ symbol, message })
      console.error(`\n${symbol} için backtest yapılamadı: ${message}`)
    }
  }

  console.log(`\ntoplam süre  : ${((Date.now() - t0) / 1000).toFixed(1)} sn`)

  if (REPORT_JSON) {
    const bundle: BacktestBundle = {
      source,
      generatedAt: new Date().toISOString(),
      interval: INTERVAL,
      ablation: BOOK_FEATURES.map((k) => FEATURE_LABELS[k]),
      reports,
      errors,
    }
    writeFileSync(REPORT_JSON, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8')
    console.log(`rapor yazıldı: ${REPORT_JSON} (${reports.length} rapor, ${errors.length} hata)`)
  }

  if (reports.length === 0) {
    throw new Error(
      `hiçbir sembol için gerçek veri alınamadı — ${errors.map((e) => `${e.symbol}: ${e.message}`).join(' | ')}`,
    )
  }
}

// Vitest altında modül import edilebilir kalmalı (runBacktest birim testleri);
// script yalnızca doğrudan çalıştırıldığında ağ isteği yapar.
if (!process.env.VITEST) {
  main().catch((err: unknown) => {
    console.error(`\nbacktest başarısız: ${err instanceof Error ? err.message : String(err)}`)
    console.error('İpucu: ağ erişimi yoksa gerçek kline dosyasını KLINES_FILE ile verin.')
    process.exitCode = 1
  })
}
