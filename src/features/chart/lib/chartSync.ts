import type { Candle } from '@/entities'
import { sameCandle } from '@/shared/lib/candles'

/**
 * Grafik senkronizasyon planlayıcısı.
 *
 * lightweight-charts `series.update()` çağrısı, serideki en son mumdan DAHA ESKİ
 * bir zamanla çağrılırsa şu hatayı fırlatır:
 *
 *   "Cannot update oldest data, last time=[object Object], new time=[object Object]"
 *
 * (v4.2.x iç zaman tipi `{ _internal_timestamp }` nesnesi olduğu için mesajda
 *  gerçek zamanlar yerine `[object Object]` görünür.)
 *
 * Gerçek borsa akışında bu durum olağandır: yeniden bağlanma sonrası REST geçmişi
 * canlı mumların arkasından gelir, WS mesajları tekrar/gecikmeli düşebilir, sembol
 * değişince seri sıfırlanır. Bu yüzden hangi durumda tam yeniden çizim (`setData`),
 * hangi durumda artımlı güncelleme (`update`) yapılacağı burada açıkça karara bağlanır
 * ve UI'dan bağımsız olarak test edilir.
 */

export interface ChartSyncState {
  /** Çizilen verinin kaynağı (symbol:timeframe) */
  key: string
  initialized: boolean
  count: number
  lastTime: number
  lastCandle: Candle | null
  /** Store'un pencere-yapısı sayacı — değiştiyse artımlı çizim güvenli değildir */
  rewriteSeq: number
}

export const INITIAL_SYNC_STATE: ChartSyncState = {
  key: '',
  initialized: false,
  count: 0,
  lastTime: 0,
  lastCandle: null,
  rewriteSeq: 0,
}

export type ChartSyncPlan =
  /** Yapılacak bir şey yok (veri aynı) */
  | { kind: 'skip' }
  /** Seriyi tamamen yeniden yaz (setData) */
  | { kind: 'full' }
  /** Seriyi boşalt (setData([])) — feed sıfırlandı, veri kalmadı */
  | { kind: 'clear' }
  /** Yalnızca son mumu güncelle (update) */
  | { kind: 'tail'; candle: Candle }

export function planChartSync(
  state: ChartSyncState,
  candles: Candle[],
  key: string,
  rewriteSeq: number,
): ChartSyncPlan {
  if (candles.length === 0) {
    // çizilmiş bir seri varsa boşalt; seri zaten boşsa yapılacak iş yok
    return state.initialized || state.count > 0 ? { kind: 'clear' } : { kind: 'skip' }
  }
  // sembol/timeframe değişti, ilk veri, ya da pencere yapısı değişti → tam çizim
  if (!state.initialized || state.key !== key || state.rewriteSeq !== rewriteSeq) {
    return { kind: 'full' }
  }
  const last = candles[candles.length - 1]
  // geriye sarma: gecikmeli/tekrarlanan mum veya geçmiş birleşmesi → tam çizim
  if (last.time < state.lastTime) return { kind: 'full' }
  // pencere küçüldü (mum düştü) → seri baştan yazılmalı
  if (candles.length < state.count) return { kind: 'full' }
  // son mum değişmedi → gereksiz çizim yapma
  if (
    last.time === state.lastTime &&
    state.lastCandle !== null &&
    sameCandle(last, state.lastCandle)
  ) {
    return { kind: 'skip' }
  }
  return { kind: 'tail', candle: last }
}

export function commitChartSync(
  state: ChartSyncState,
  plan: ChartSyncPlan,
  candles: Candle[],
  key: string,
  rewriteSeq: number,
): ChartSyncState {
  switch (plan.kind) {
    case 'skip':
      return state
    case 'clear':
      return { ...INITIAL_SYNC_STATE, key, rewriteSeq }
    case 'full':
    case 'tail': {
      const last = candles[candles.length - 1]
      if (!last) return { ...INITIAL_SYNC_STATE, key, rewriteSeq }
      return {
        key,
        initialized: true,
        count: candles.length,
        lastTime: last.time,
        lastCandle: { ...last },
        rewriteSeq,
      }
    }
  }
}
