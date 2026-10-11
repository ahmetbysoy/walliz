import { create } from 'zustand'
import type { LearningState } from '@/entities'
import { createEmptyLearningState, loadLearning, saveLearning } from '@/shared/lib/learningRepo'

export interface LearningStoreState {
  symbol: string
  state: LearningState
  loaded: boolean
  /** Öğrenme state'i kaç kez güncellendi (yükleme yarışlarını ayırt etmek için) */
  revision: number
  load: (symbol: string) => Promise<void>
  update: (fn: (s: LearningState) => LearningState) => void
  replace: (s: LearningState) => void
}

/**
 * Sembol başına öğrenme state'i — her güncellemede IndexedDB'ye persist.
 *
 * Yarış koruması: diskten yükleme beklerken gelen taze doğrulamalar (update/replace)
 * diskteki eski kayıt tarafından EZİLMEZ. Sembol değişiminde önce boş state yazılır;
 * böylece önceki sembolün ağırlıkları yeni sembolde bir an bile kullanılmaz.
 */
export const useLearningStore = create<LearningStoreState>()((set, get) => ({
  symbol: '',
  state: createEmptyLearningState(),
  loaded: false,
  revision: 0,

  load: async (symbol) => {
    if (get().loaded && get().symbol === symbol) return
    const previous = get()
    if (previous.symbol !== symbol || !previous.loaded) {
      set({ symbol, state: createEmptyLearningState(), loaded: false })
    }
    const revision = get().revision
    const state = await loadLearning(symbol)

    const current = get()
    // bu arada başka bir yükleme başladıysa onun sonucu geçerlidir
    if (current.symbol !== symbol) return
    if (current.revision !== revision) {
      // yükleme sürerken yeni doğrulama işlendi → taze veri korunur
      console.warn(
        `[lanka] ${symbol} öğrenme verisi yüklenirken güncellendi — diskteki eski kayıt uygulanmadı`,
      )
      set({ loaded: true })
      return
    }
    set({ state, loaded: true })
  },

  update: (fn) => {
    const { symbol, state } = get()
    const next = fn(state)
    set((s) => ({ state: next, revision: s.revision + 1 }))
    void saveLearning(symbol, next)
  },

  replace: (s) => {
    const { symbol } = get()
    set((cur) => ({ state: s, revision: cur.revision + 1 }))
    void saveLearning(symbol, s)
  },
}))
