export type WallSide = 'bid' | 'ask'

export interface Wall {
  side: WallSide
  price: number
  /** Birleşen seviyelerin toplam hacmi */
  qty: number
  /** Birleşen seviye sayısı */
  levels: number
  /** windowQty / (median * window) — en az multiplier kadar */
  strength: number
  /** Bu duvarın kaç tick'tır aynı fiyatta durduğu */
  ageTicks: number
  /** stableAfterTicks kadar yaşıtlı duvar */
  stable: boolean
}
