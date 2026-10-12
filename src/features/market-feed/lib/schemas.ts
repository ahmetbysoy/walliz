import { z } from 'zod'

/** Binance WS mesaj şemaları — geçersiz mesaj loglanır, stream düşürülmez. */

export const numLike = z.union([z.string().regex(/^[+-]?\d+(\.\d+)?$/), z.number()])

export const toNumber = (v: z.infer<typeof numLike>): number =>
  typeof v === 'number' ? v : Number(v)

/**
 * Kısmi derinlik (partial book depth) yükü — resmî tel formatı:
 *
 *   { "lastUpdateId": 160, "bids": [["0.0024","10"]], "asks": [["0.0026","100"]] }
 *
 * KRİTİK: Spot kısmi derinlik akışında (`<symbol>@depth20@100ms`) **`e` (event type)
 * alanı YOKTUR** ve güncelleme kimliği `lastUpdateId` alanındadır. `e: "depthUpdate"`,
 * `u`/`U` gibi alanlar farklı derinlik akışlarına (`<symbol>@depth`, vadeli sözleşmeler)
 * aittir. Bu yüzden mesaj tipi olay adından değil, yükün şeklinden tespit edilir
 * (bkz. liveFeed.ts → isDepthSnapshot); şema yalnız yükü doğrular.
 *
 * Kaynak: binance-spot-api-docs → "Partial Book Depth Streams".
 */
export const depth20Schema = z.object({
  /** Kısmi derinlik akışındaki gerçek güncelleme kimliği */
  lastUpdateId: z.number().optional(),
  /** Fark depth akışı biçimi (tolerans): son güncelleme kimliği */
  u: z.number().optional(),
  /** Fark depth akışı biçimi (tolerans): ilk güncelleme kimliği */
  U: z.number().optional(),
  /** Bazı akışlarda bulunur; kısmi derinlikte yoktur (tolerans) */
  e: z.string().optional(),
  /** [fiyat, miktar] satırları — telde string gelir; fazladan sütun olabilir */
  bids: z.array(z.array(numLike).min(2)).min(1),
  asks: z.array(z.array(numLike).min(2)).min(1),
})

export const klineSchema = z.object({
  e: z.literal('kline'),
  k: z.object({
    t: z.number(),
    o: numLike,
    h: numLike,
    l: numLike,
    c: numLike,
    v: numLike,
    x: z.boolean(),
  }),
})

/**
 * 24 saatlik sembol ticker yükü (`<symbol>@ticker`) — resmî tel formatı.
 *
 * KRİTİK: 24s yüksek/düşük fiyatlar **küçük harf** `h` / `l` alanlarındadır.
 * Aynı yükteki **büyük harf `L` "son işlem kimliği"dir (last trade ID)**, fiyat
 * değildir — bu yüzden `L`/`H` fiyat olarak okunmaz (yanlış veri göstermemek için
 * şema bu alanları hiç kabul etmez).
 *
 * Kaynak: binance-spot-api-docs → "Individual Symbol Ticker Streams".
 */
export const tickerSchema = z.object({
  e: z.literal('24hrTicker'),
  /** Son fiyat */
  c: numLike,
  /** 24s değişim yüzdesi */
  P: numLike,
  /** 24s yüksek (küçük harf!) */
  h: numLike,
  /** 24s düşük (küçük harf!) */
  l: numLike,
  /** 24s toplam işlem hacmi (base asset) */
  v: numLike,
})

export type Depth20Msg = z.infer<typeof depth20Schema>
export type KlineMsg = z.infer<typeof klineSchema>
export type TickerMsg = z.infer<typeof tickerSchema>
