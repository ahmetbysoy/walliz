import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useMarketStore } from '@/shared/model/marketStore'
import { getCoin } from '@/shared/config/coins'
import { formatPrice } from '@/shared/lib/format'
import { loadPreferences } from '@/shared/lib/learningRepo'
import { haptic } from '@/shared/lib/haptics'

export function useWallAlerts(ready: boolean) {
  const walls = useMarketStore((s) => s.walls)
  const price = useMarketStore((s) => s.price)
  const symbol = useMarketStore((s) => s.symbol)
  const coin = getCoin(symbol)

  const seenWallsRef = useRef<Set<string>>(new Set())
  const lastAlertTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!ready || !price || walls.length === 0) return

    let cancelled = false
    void loadPreferences().then((p) => {
      if (cancelled) return
      const threshold = p.wallAlertThreshold ?? 0.5
      const now = Date.now()

      const currentKeys = new Set<string>()

      for (const w of walls) {
        const key = `${w.side}:${w.price}`
        currentKeys.add(key)

        const distPct = (Math.abs(w.price - price) / price) * 100
        const isStrong = w.strength >= 2.0 && distPct <= threshold

        // Daha önce görmediğimiz güçlü bir yakın duvar yeni belirdiyse ve 10 saniyede en fazla 1 uyarı
        if (isStrong && !seenWallsRef.current.has(key) && now - lastAlertTimeRef.current > 10_000) {
          lastAlertTimeRef.current = now
          const sideText = w.side === 'bid' ? 'Alıcı Duvarı' : 'Satıcı Duvarı'
          const formatted = formatPrice(w.price, coin.priceDecimals)
          toast.info(`🔔 Güçlü ${sideText} belirdi: ${formatted} (%${distPct.toFixed(2)} mesafede)`, {
            description: 'Uygulama açıkken canlı duvar takibi',
            duration: 4000,
          })
          haptic([30, 50, 30])
        }
      }

      seenWallsRef.current = currentKeys
    })

    return () => {
      cancelled = false
    }
  }, [ready, walls, price, symbol, coin.priceDecimals])
}
