/**
 * Wall worker: duvar tespiti + feature hesabı main thread'den uzak.
 * Vite bu dosyayı ayrı chunk olarak bundle'lar (new URL ile referans).
 */
import type { BookSnapshot, Candle, FeatureVector, Wall } from '@/entities'
import { computeFeatures } from '@/shared/lib/features'
import { WallTracker, detectWalls } from '@/shared/lib/walls'

export interface WorkerInput {
  type: 'update'
  book: BookSnapshot
  candles: Candle[]
  multiplier: number
  window: number
  maxWalls: number
  stableAfterTicks: number
}

export type WorkerCommand = WorkerInput | { type: 'reset' }

export interface WorkerOutput {
  type: 'result'
  walls: Wall[]
  features: FeatureVector | null
}

interface WorkerContext {
  onmessage: ((ev: MessageEvent<WorkerCommand>) => void) | null
  postMessage: (msg: WorkerOutput) => void
}

const ctx = self as unknown as WorkerContext
let tracker = new WallTracker(5)

ctx.onmessage = (ev: MessageEvent<WorkerCommand>) => {
  const msg = ev.data
  if (!msg) return
  if (msg.type === 'reset') {
    tracker.reset()
    return
  }
  if (msg.type !== 'update') return
  if (tracker.stableAfter !== msg.stableAfterTicks) {
    tracker = new WallTracker(msg.stableAfterTicks)
  }
  const base = detectWalls(msg.book, {
    multiplier: msg.multiplier,
    window: msg.window,
    maxWalls: msg.maxWalls,
  })
  const walls = tracker.tick(base)
  const features = computeFeatures({ candles: msg.candles, book: msg.book, walls })
  ctx.postMessage({ type: 'result', walls, features })
}
