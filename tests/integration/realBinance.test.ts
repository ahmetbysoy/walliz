import { describe, expect, it } from 'vitest'
import { klineUrl, parseKlineRows } from '@/shared/lib/klines'
import { REST_BASE } from '@/shared/config/coins'

/**
 * GERÇEK borsa bağlantı testi (opt-in).
 *
 * Varsayılan olarak atlanır — CI/sandbox ağ erişimi garanti değildir. Gerçek
 * Binance REST uç noktasına bağlanılabilen bir ortamda şu komutla çalıştırın:
 *
 *   LANKA_LIVE_NETWORK=1 npm run test
 *
 * Test, canlı uç noktadan gerçek BTCUSDT mumlarını çeker ve ayrıştırıcının
 * gerçek yanıtı doğru okuduğunu doğrular (uydurma veri kullanılmaz).
 */
const enabled = process.env.LANKA_LIVE_NETWORK === '1'

describe.skipIf(!enabled)('gerçek Binance REST (/api/v3/klines)', () => {
  it('canlı uç noktadan alınan mumlar artan sırada ve geçerli', async () => {
    const res = await fetch(klineUrl(REST_BASE, 'BTCUSDT', '1m', 50))
    expect(res.ok).toBe(true)
    const rows = (await res.json()) as unknown[]
    expect(Array.isArray(rows)).toBe(true)

    const candles = parseKlineRows(rows, Date.now())
    expect(candles.length).toBeGreaterThan(40)
    for (const c of candles) {
      expect(c.time).toBeGreaterThan(0)
      expect(c.close).toBeGreaterThan(0)
      expect(c.high).toBeGreaterThanOrEqual(c.low)
    }
    const times = candles.map((c) => c.time)
    expect([...times].sort((a, b) => a - b)).toEqual(times)
    expect(new Set(times).size).toBe(times.length)
  }, 30_000)
})
