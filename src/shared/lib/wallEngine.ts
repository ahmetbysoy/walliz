import type { BookSnapshot, Candle, FeatureVector, Wall } from '@/entities'
import { computeFeatures } from './features'
import { WallTracker, detectWalls } from './walls'

/**
 * WallEngine: worker'ı sarmalayan istemci. Worker üretilemediği ortamlarda
 * (test, bazı webview'lar) aynı saf fonksiyonları inline çalıştırır —
 * davranış farkı yoktur.
 */

export interface WallPushInput {
  book: BookSnapshot
  candles: Candle[]
  multiplier: number
  window: number
  maxWalls: number
  stableAfterTicks: number
}

export interface WallEngineResult {
  walls: Wall[]
  features: FeatureVector | null
}

export interface WallEngine {
  push(input: WallPushInput): void
  onResult(cb: (r: WallEngineResult) => void): () => void
  reset(): void
  dispose(): void
}

function createInlineEngine(): WallEngine {
  let tracker: WallTracker | null = null
  const cbs = new Set<(r: WallEngineResult) => void>()

  const run = (input: WallPushInput): WallEngineResult => {
    if (!tracker || tracker.stableAfter !== input.stableAfterTicks) {
      tracker = new WallTracker(input.stableAfterTicks)
    }
    const walls = tracker.tick(
      detectWalls(input.book, {
        multiplier: input.multiplier,
        window: input.window,
        maxWalls: input.maxWalls,
      }),
    )
    const features = computeFeatures({ candles: input.candles, book: input.book, walls })
    return { walls, features }
  }

  return {
    push: (input) => {
      const r = run(input)
      cbs.forEach((cb) => cb(r))
    },
    onResult: (cb) => {
      cbs.add(cb)
      return () => cbs.delete(cb)
    },
    reset: () => tracker?.reset(),
    dispose: () => cbs.clear(),
  }
}

function createWorkerEngine(worker: Worker): WallEngine {
  const cbs = new Set<(r: WallEngineResult) => void>()
  worker.onmessage = (
    ev: MessageEvent<{ type: 'result'; walls: Wall[]; features: FeatureVector | null }>,
  ) => {
    const d = ev.data
    if (d && d.type === 'result') {
      const r: WallEngineResult = { walls: d.walls, features: d.features }
      cbs.forEach((cb) => cb(r))
    }
  }
  return {
    push: (input) => worker.postMessage({ type: 'update', ...input }),
    onResult: (cb) => {
      cbs.add(cb)
      return () => cbs.delete(cb)
    },
    reset: () => worker.postMessage({ type: 'reset' }),
    dispose: () => {
      worker.terminate()
      cbs.clear()
    },
  }
}

export function createWallEngine(opts: { useWorker?: boolean } = {}): WallEngine {
  const isTest = import.meta.env.MODE === 'test'
  if (opts.useWorker !== false && !isTest && typeof Worker !== 'undefined') {
    try {
      const worker = new Worker(new URL('../workers/wallWorker.ts', import.meta.url), {
        type: 'module',
      })
      return createWorkerEngine(worker)
    } catch {
      /* worker başlatılamadı → inline fallback */
    }
  }
  return createInlineEngine()
}
