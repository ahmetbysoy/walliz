/**
 * Backtest — GERÇEK borsa verisiyle (Binance `/api/v3/klines`).
 *
 * Kullanım:
 *   npm run backtest                                  → BTCUSDT 1m, 3000 mum
 *   SYMBOL=ETHUSDT INTERVAL=5m N=10000 npm run backtest
 *   KLINES_FILE=/veri/btcusdt-1m.json npm run backtest  → indirilmiş gerçek kline dosyası
 *
 * Önemli — veri kaynağı:
 * - Simülasyon/sentetik seri ÜRETİLMEZ. Veri yoksa script hata verip çıkar (exit 1).
 * - Binance public API geçmiş orderbook derinliği yayınlamaz. Bu yüzden kitap türevi
 *   iki feature (imbalance, wallPressure) geçmişte yeniden oynatılamaz; backtest bu
 *   iki feature'ı ABLASYONLA devre dışı bırakır (ağırlıkları her adımda 0) ve
 *   yalnızca fiyat türevi feature'larla (momentum, trend, volatility) ölçüm yapar.
 *   Bu, modelin kitap verisi olmadan ne yaptığını dürüstçe ölçer.
 */
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
const INTERVAL = process.env.INTERVAL ?? '1m'
const N = Number(process.env.N ?? 3000)
const KLINES_FILE = process.env.KLINES_FILE ?? ''
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

async function requestPage(
  host: string,
  limit: number,
  endTimeMs: number | undefined,
): Promise<unknown[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(klineUrl(host, SYMBOL, INTERVAL, limit, endTimeMs), {
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
async function fetchRealKlines(): Promise<Candle[]> {
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
        const rows = await requestPage(host, limit, endTimeMs)
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
    const oldest = page[0].time * 1000
    endTimeMs = oldest - 1
    process.stdout.write(`\r  çekilen mum: ${collected.size}/${N}`)
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

function iso(sec: number): string {
  return new Date(sec * 1000).toISOString().replace('T', ' ').slice(0, 19)
}

async function main() {
  console.log('── LANKA backtest — GERÇEK piyasa verisi ─────────')
  const t0 = Date.now()
  const candles = KLINES_FILE ? await readKlinesFile(KLINES_FILE) : await fetchRealKlines()
  if (candles.length < WARMUP + WINDOW) {
    throw new Error(
      `yeterli gerçek veri yok (${candles.length} mum) — ağ erişimi ya da KLINES_FILE gerekli`,
    )
  }
  console.log(`kaynak       : ${KLINES_FILE ? `dosya (${KLINES_FILE})` : REST_HOSTS.join(' / ')}`)
  console.log(`sembol/aralık: ${SYMBOL} ${INTERVAL}`)
  console.log(
    `mum          : ${candles.length} adet · ${iso(candles[0].time)} → ${iso(candles[candles.length - 1].time)}`,
  )
  console.log(`son fiyat    : ${candles[candles.length - 1].close}`)
  console.log(`çekme süresi : ${((Date.now() - t0) / 1000).toFixed(1)} sn`)
  console.log(
    `ablasyon     : ${BOOK_FEATURES.map((k) => FEATURE_LABELS[k]).join(', ')} devre dışı ` +
      '(geçmiş orderbook derinliği public API\u2019de yok)',
  )

  let weights = createInitialWeights().values
  let hits = 0
  let misses = 0
  let neutrals = 0
  let skipped = 0
  const bandStats: Record<string, { total: number; hits: number }> = {
    high: { total: 0, hits: 0 },
    medium: { total: 0, hits: 0 },
    low: { total: 0, hits: 0 },
  }

  for (let i = Math.max(WARMUP, WINDOW); i < candles.length; i++) {
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

  const decided = hits + misses
  console.log('')
  console.log(`ölçülen mum  : ${candles.length - Math.max(WARMUP, WINDOW)} (atlanan: ${skipped})`)
  console.log(
    `sonuç        : isabet=${hits} ıskalama=${misses} nötr=${neutrals} → isabet %${
      decided ? ((hits / decided) * 100).toFixed(1) : '—'
    } (${decided} karar)`,
  )
  for (const [band, s] of Object.entries(bandStats)) {
    const rate = s.total ? ((s.hits / s.total) * 100).toFixed(1) : '—'
    console.log(`  kova ${band.padEnd(6)} ${String(s.total).padStart(5)} tahmin · isabet %${rate}`)
  }
  console.log('son ağırlıklar (ablasyon uygulanmış):')
  for (const k of FEATURE_KEYS)
    console.log(`  ${FEATURE_LABELS[k].padEnd(14)} ${weights[k].toFixed(4)}`)
}

main().catch((err: unknown) => {
  console.error(`\nbacktest başarısız: ${err instanceof Error ? err.message : String(err)}`)
  console.error('İpucu: ağ erişimi yoksa gerçek kline dosyasını KLINES_FILE ile verin.')
  process.exitCode = 1
})
