import type { LearningState } from '@/entities'
import { sanitizeLearningState } from '@/shared/lib/learningRepo'

/** Öğrenme verisi export/import (JSON dosya). */

export function toExportJSON(state: LearningState, symbol: string): string {
  return JSON.stringify(
    {
      app: 'lanka',
      kind: 'learning',
      version: 2,
      symbol,
      exportedAt: new Date().toISOString(),
      state,
    },
    null,
    2,
  )
}

export function parseImport(text: string): { state: LearningState; symbol?: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Geçersiz JSON dosyası')
  }
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as {
    state?: unknown
    symbol?: unknown
  }
  const state = sanitizeLearningState(r.state ?? raw)
  const symbol = typeof r.symbol === 'string' ? r.symbol : undefined
  return { state, symbol }
}

export function downloadJSON(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
