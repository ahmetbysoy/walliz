import type { Candle } from '@/entities'
import { MAX_CANDLES } from '@/shared/config/coins'

/**
 * Mum listesi işlemleri — gerçek borsa akışının sıralama kuralları.
 *
 * Canlı WS mesajları, REST geçmişi ve yeniden bağlanma sonrası tekrarlar aynı
 * listeye karışır. Bu yüzden liste her zaman:
 *  - zamana göre ARTAN,
 *  - zaman başına TEK kayıt,
 *  - en fazla `MAX_CANDLES` kayıt
 * olacak şekilde tutulur. Grafik motoru (lightweight-charts) `update()` çağrısında
 * geriye giden zaman kabul etmez ve hata fırlatır; bu kurallar o durumun oluşmasını
 * kaynağında engeller.
 */

/** İki mumun tüm alanları aynı mı? (gereksiz render'ı önlemek için) */
export function sameCandle(a: Candle, b: Candle): boolean {
  return (
    a.time === b.time &&
    a.open === b.open &&
    a.high === b.high &&
    a.low === b.low &&
    a.close === b.close &&
    a.volume === b.volume &&
    a.closed === b.closed
  )
}

/**
 * Tek mumu sıralı listeye yerleştirir (upsert).
 * - Aynı zaman varsa günceller (kapanmış mum bilgisi korunur: kapanmışsa açılmaz).
 * - Zaman daha yeni ise sona ekler.
 * - Zaman eski ise (gecikmiş/tekrarlanan mesaj) doğru konuma ekler → liste hep artan kalır.
 * - Üst sınır aşılırsa en eski mumlar düşer.
 * Değişiklik yoksa girdi dizisinin kendisi döner (referans eşitliği korunur).
 */
export function upsertCandle(list: Candle[], candle: Candle): Candle[] {
  const next = list.slice()
  let lo = 0
  let hi = next.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (next[mid].time < candle.time) lo = mid + 1
    else hi = mid
  }
  const existing = next[lo]
  if (existing && existing.time === candle.time) {
    const merged: Candle = { ...candle, closed: existing.closed || candle.closed }
    if (sameCandle(existing, merged)) return list
    next[lo] = merged
  } else {
    next.splice(lo, 0, candle)
  }
  if (next.length > MAX_CANDLES) next.splice(0, next.length - MAX_CANDLES)
  return next
}

/**
 * REST geçmiş mumlarını eldeki canlı mumlarla birleştirir.
 *
 * Neden gerekli: WS bağlantısı kurulur kurulmaz canlı mumlar akmaya başlar, REST
 * geçmişi ise gecikmeli gelir. Naif "geçmiş geldi, listeyi değiştir" davranışı
 * mumları geriye sarar (grafik motoru bunu hata olarak reddeder) ve canlı veriyi
 * kaybeder.
 *
 * Kural:
 * - Geçmiş temel alınır (kapalı mumlar için kesin kaynak).
 * - Elde olup geçmişte bulunmayan mumlar (yeni canlı mumlar) korunur.
 * - Aynı zamandaki çakışmada:
 *   · geçmiş "kapalı" diyorsa geçmiş kazanır (mum kesinleşmiştir),
 *   · ikisi de açık mum ise eldeki canlı veri kazanır (daha taze).
 */
export function mergeHistory(existing: Candle[], incoming: Candle[]): Candle[] {
  const byTime = new Map<number, Candle>()
  for (const c of incoming) byTime.set(c.time, c)
  for (const c of existing) {
    const prev = byTime.get(c.time)
    if (!prev) byTime.set(c.time, c)
    else if (prev.closed) byTime.set(c.time, prev)
    else byTime.set(c.time, c)
  }
  const merged = [...byTime.values()].sort((a, b) => a.time - b.time)
  if (merged.length > MAX_CANDLES) merged.splice(0, merged.length - MAX_CANDLES)
  return merged
}

/** İki mum listesi içerik olarak aynı mı? */
export function sameCandleList(a: Candle[], b: Candle[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!sameCandle(a[i], b[i])) return false
  }
  return true
}
