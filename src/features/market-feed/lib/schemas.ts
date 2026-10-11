import { z } from 'zod'

/** Binance WS mesaj şemaları — geçersiz mesaj loglanır, stream düşürülmez. */

export const numLike = z.union([z.string().regex(/^[+-]?\d+(\.\d+)?$/), z.number()])

export const toNumber = (v: z.infer<typeof numLike>): number =>
  typeof v === 'number' ? v : Number(v)

export const depth20Schema = z.object({
  e: z.literal('depth20'),
  u: z.number().optional(),
  bids: z.array(z.tuple([numLike, numLike])).min(1),
  asks: z.array(z.tuple([numLike, numLike])).min(1),
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

export const tickerSchema = z.object({
  e: z.literal('24hrTicker'),
  c: numLike,
  P: numLike,
  H: numLike,
  L: numLike,
  v: numLike,
})

export type Depth20Msg = z.infer<typeof depth20Schema>
export type KlineMsg = z.infer<typeof klineSchema>
export type TickerMsg = z.infer<typeof tickerSchema>
