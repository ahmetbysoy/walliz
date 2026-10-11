import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyLearningState, saveLearning } from '@/shared/lib/learningRepo'
import { useLearningStore } from '@/shared/model/learningStore'
import { zeroStats } from '@/shared/lib/buckets'

/**
 * Öğrenme store'u — diskten yükleme ile canlı doğrulama arasındaki yarışlar.
 * Gerçek veride tahmin çözümü, IndexedDB yüklemesi tamamlanmadan gelebilir;
 * bu durumda taze veri diskteki eski kayıt tarafından ezilmemelidir.
 */

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  useLearningStore.setState({
    symbol: '',
    loaded: false,
    revision: 0,
    state: createEmptyLearningState(),
  })
})

describe('learningStore.load', () => {
  it('diskteki doğrulama geçmişini uygular', async () => {
    const persisted = {
      ...createEmptyLearningState(),
      stats: { ...zeroStats(), total: 4, hits: 3 },
    }
    await saveLearning('BTCUSDT', persisted)

    await useLearningStore.getState().load('BTCUSDT')

    const st = useLearningStore.getState()
    expect(st.loaded).toBe(true)
    expect(st.symbol).toBe('BTCUSDT')
    expect(st.state.stats.total).toBe(4)
    expect(st.state.stats.hits).toBe(3)
  })

  it('zaten yüklüyse tekrar okumaz', async () => {
    const persisted = { ...createEmptyLearningState(), stats: { ...zeroStats(), total: 7 } }
    await saveLearning('BTCUSDT', persisted)
    await useLearningStore.getState().load('BTCUSDT')
    const revision = useLearningStore.getState().revision

    await useLearningStore.getState().load('BTCUSDT')
    expect(useLearningStore.getState().state.stats.total).toBe(7)
    expect(useLearningStore.getState().revision).toBe(revision)
  })

  it('yükleme sürerken gelen taze doğrulama diskteki eski kayıtla EZİLMEZ', async () => {
    const persisted = { ...createEmptyLearningState(), stats: { ...zeroStats(), total: 2 } }
    await saveLearning('BTCUSDT', persisted)

    const loading = useLearningStore.getState().load('BTCUSDT')
    // disk okuması çözülmeden yeni doğrulama işlenir
    useLearningStore.getState().update((s) => ({
      ...s,
      stats: { ...s.stats, total: s.stats.total + 1, hits: s.stats.hits + 1 },
    }))
    await loading

    const st = useLearningStore.getState()
    expect(st.loaded).toBe(true)
    expect(st.state.stats.total).toBe(1)
    expect(st.state.stats.hits).toBe(1)
  })

  it('sembol değişiminde önceki sembolün verisi anında temizlenir (karışma olmaz)', async () => {
    const ethState = { ...createEmptyLearningState(), stats: { ...zeroStats(), total: 9, hits: 8 } }
    await saveLearning('ETHUSDT', ethState)
    useLearningStore.setState({
      symbol: 'BTCUSDT',
      loaded: true,
      revision: 3,
      state: { ...createEmptyLearningState(), stats: { ...zeroStats(), total: 5, hits: 5 } },
    })

    const loading = useLearningStore.getState().load('ETHUSDT')
    // yükleme çözülmeden eski sembolün verisi görünmemeli
    expect(useLearningStore.getState().symbol).toBe('ETHUSDT')
    expect(useLearningStore.getState().loaded).toBe(false)
    expect(useLearningStore.getState().state.stats.total).toBe(0)

    await loading
    expect(useLearningStore.getState().state.stats.total).toBe(9)
    expect(useLearningStore.getState().loaded).toBe(true)
  })
})

describe('learningStore.update / replace', () => {
  it('her güncellemede revision artar (yükleme kontrolü bu sayaca dayanır)', () => {
    const before = useLearningStore.getState().revision
    useLearningStore.getState().update((s) => s)
    useLearningStore.getState().replace(createEmptyLearningState())
    expect(useLearningStore.getState().revision).toBe(before + 2)
  })

  it('import edilen state replace ile uygulanır', () => {
    const imported = {
      ...createEmptyLearningState(),
      stats: { ...zeroStats(), total: 12, hits: 9 },
    }
    useLearningStore.getState().replace(imported)
    expect(useLearningStore.getState().state.stats.total).toBe(12)
  })
})
