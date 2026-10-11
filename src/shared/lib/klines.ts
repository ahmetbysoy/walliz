import type { Candle } from '@/entities'
import { MAX_CANDLES, REST_BASE } from '@/shared/config/coins'

/**
 * Binance `/api/v3/klines` ham verisi → mum.
 *
 * Satır düzeni (borsanın gerçek yanıtı):
 *   [ openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, ... ]
 *
 * Kapanmışlık bilgisi uydurulmaz: son sütunlardaki gerçek `closeTime` ile şimdiki
 * zaman karşılaştırılır. En son satır genellikle hâlâ açık olan mumdur.
 */

export function isValidCandle(c: Candle): boolean {
  return (
    Number.isFinite(c.time) &&
    c.time > 0 &&
    Number.isFinite(c.open) &&
    Number.isFinite(c.high) &&
    Number.isFinite(c.low) &&
    Number.isFinite(c.close) &&
    Number.isFinite(c.volume) &&
    c.open > 0 &&
    c.high > 0 &&
    c.low > 0 &&
    c.close > 0 &&
    c.high >= c.low
  )
}

/** Tek satırı muma çevirir; geçersizse null (uydurma değer üretilmez). */
export function parseKlineRow(row: unknown, nowMs: number): Candle | null {
  if (!Array.isArray(row) || row.length < 6) return null
  const time = Math.floor(Number(row[0]) / 1000)
  const candle: Candle = {
    time,
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    closed: row.length >= 7 ? Number(row[6]) <= nowMs : false,
  }
  return isValidCandle(candle) ? candle : null
}

/** Satır listesini zamana göre artan, tekil mum dizisine çevirir. */
export function parseKlineRows(rows: unknown[], nowMs: number): Candle[] {
  const byTime = new Map<number, Candle>()
  for (const row of rows) {
    const candle = parseKlineRow(row, nowMs)
    if (!candle) continue
    // aynı açılış zamanı tekrar gelirse son satır geçerlidir
    byTime.set(candle.time, candle)
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time)
}

export function klineUrl(
  host: string,
  symbol: string,
  timeframe: string,
  limit: number,
  /** Sayfalanmış geçmiş çekimi için: bu zamandan (ms) önceki mumlar istenir */
  endTimeMs?: number,
): string {
  const base = `${host}/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=${limit}`
  return endTimeMs === undefined ? base : `${base}&endTime=${Math.floor(endTimeMs)}`
}

/** Varsayılan REST host'u ile kline adresi (uygulama içi kullanım). */
export function defaultKlineUrl(symbol: string, timeframe: string, limit = MAX_CANDLES): string {
  return klineUrl(REST_BASE, symbol, timeframe, limit)
}
