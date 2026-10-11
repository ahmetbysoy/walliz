import { create } from 'zustand'
import type { LearningState } from '@/entities'
import { createEmptyLearningState, loadLearning, saveLearning } from '@/shared/lib/learningRepo'

export interface LearningStoreState {
  symbol: string
  state: LearningState
  loaded: boolean
  load: (symbol: string) => Promise<void>
  update: (fn: (s: LearningState) => LearningState) => void
  replace: (s: LearningState) => void
}

/** Sembol başına öğrenme state'i — her güncellemede IndexedDB'ye persist. */
export const useLearningStore = create<LearningStoreState>()((set, get) => ({
  symbol: '',
  state: createEmptyLearningState(),
  loaded: false,

  load: async (symbol) => {
    if (get().loaded && get().symbol === symbol) return
    const state = await loadLearning(symbol)
    set({ symbol, state, loaded: true })
  },

  update: (fn) => {
    const { symbol, state } = get()
    const next = fn(state)
    set({ state: next })
    void saveLearning(symbol, next)
  },

  replace: (s) => {
    const { symbol } = get()
    set({ state: s })
    void saveLearning(symbol, s)
  },
}))
