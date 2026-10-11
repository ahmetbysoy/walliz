import { get as idbGet, set as idbSet } from 'idb-keyval'

/** IndexedDB (idb-keyval) üzerinde JSON depolama — sessiz hata toleransı. */

export const learningKey = (symbol: string): string => `lanka:learning:${symbol}`
export const preferencesKey = 'lanka:preferences'

export async function readJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await idbGet<string>(key)
    if (raw == null) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    await idbSet(key, JSON.stringify(value))
  } catch {
    /* kota / private mode — sessizce geç */
  }
}
