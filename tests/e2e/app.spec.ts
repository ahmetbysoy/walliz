import { test, expect, type Page } from '@playwright/test'

/**
 * E2E — GERÇEK borsa verisiyle.
 *
 * Uygulama simülasyon modu içermediği için testler de taklit veri beklemez:
 * - Borsa erişilebilirse: gerçek akıştan gelen fiyat/mum/kitap doğrulanır.
 * - Erişilemezse: akış testleri atlanır ve dürüst çevrimdışı davranışı doğrulanır.
 */

const PILL = /feed durumu/i
const ANY_STATUS = /CANLI|AÇILIYOR|BAĞLANIYOR|ÇEVRİMDIŞI/
const REST_CANDIDATES = ['https://api.binance.com', 'https://data-api.binance.vision']
const PING_TIMEOUT_MS = 8_000

/** Uygulamayla aynı borsa uç noktalarına bu koşucudan erişilebiliyor mu? */
async function reachableRestHost(page: Page): Promise<string | null> {
  return page.evaluate(
    async ({ hosts, timeoutMs }) => {
      for (const host of hosts) {
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), timeoutMs)
          const res = await fetch(`${host}/api/v3/ping`, { signal: controller.signal })
          clearTimeout(timer)
          if (res.ok) return host
        } catch {
          // sıradaki gerçek host denenir
        }
      }
      return null
    },
    { hosts: REST_CANDIDATES, timeoutMs: PING_TIMEOUT_MS },
  )
}

test.describe('LANKA mobil akış', () => {
  test('açılır, feed durumu ve grafik alanı çizilir', async ({ page }) => {
    await page.goto('/')
    const pill = page.getByRole('button', { name: PILL })
    await expect(pill).toBeVisible()
    await expect(pill).toHaveText(ANY_STATUS)

    const chart = page.locator('[data-chart-root]')
    await expect(chart).toBeVisible()
    await expect(chart.getByRole('status').or(chart.getByRole('img'))).toBeVisible({
      timeout: 10_000,
    })
  })

  test('gerçek veri bağlanınca fiyat ve grafik gelir (borsa erişilebilirse)', async ({ page }) => {
    await page.goto('/')
    const host = await reachableRestHost(page)
    test.skip(host === null, 'Bu koşucudan gerçek borsa uç noktalarına erişilemiyor')

    const pill = page.getByRole('button', { name: PILL })
    await expect(pill).toHaveText('CANLI', { timeout: 30_000 })

    const price = page.locator('header span.tabular-nums').first()
    await expect(price).toHaveText(/\d[\d.,]*/, { timeout: 30_000 })

    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 })
  })

  test('duvarlar paneli gerçek orderbook satırlarını listeler (borsa erişilebilirse)', async ({
    page,
  }) => {
    await page.goto('/')
    const host = await reachableRestHost(page)
    test.skip(host === null, 'Bu koşucudan gerçek borsa uç noktalarına erişilemiyor')

    const pill = page.getByRole('button', { name: PILL })
    await expect(pill).toHaveText('CANLI', { timeout: 30_000 })
    await page.getByRole('button', { name: 'Duvarlar' }).click()
    await expect(page.getByLabel('Alış tarafı (bids)')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByLabel('Satış tarafı (asks)')).toBeVisible()
  })

  test('çevrimdışı: uygulama veri uydurmaz, durumu bildirir', async ({ page }) => {
    // WebSocket ve API çağrılarını engelleyerek çevrimdışı simüle et
    await page.route('**/*', (route) => {
      const url = route.request().url()
      if (url.includes('binance.com') || url.includes('binance.vision')) {
        return route.abort('failed')
      }
      return route.continue()
    })
    await page.goto('/')

    const pill = page.getByRole('button', { name: PILL })
    await expect(pill).toHaveText(/BAĞLANIYOR|ÇEVRİMDIŞI|AÇILIYOR/, { timeout: 10_000 })
  })

  test('coin değiştirince header güncellenir', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('combobox', { name: 'Coin seç' }).click()
    await page.getByRole('option', { name: 'DOGE' }).click()
    await expect(page.locator('header')).toContainText('DOGE')
  })

  test('timeframe chip değiştirilebilir', async ({ page }) => {
    await page.goto('/')
    const chip5m = page.getByRole('tab', { name: '5m mum', exact: true })
    await chip5m.click()
    await expect(chip5m).toHaveAttribute('aria-selected', 'true')
  })

  test('tab navigasyonu panelleri açar (3 tab: Grafik, Duvarlar, Model)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Duvarlar' }).click()
    await expect(page.getByRole('region', { name: 'Duvarlar' })).toBeVisible()

    await page.getByRole('button', { name: 'Model', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Model' })).toBeVisible()

    // Model içerisindeki alt sekmeler
    await page.getByRole('tab', { name: 'Hafıza sekmesi' }).click()
    await expect(page.getByText('Ağırlıklar')).toBeVisible()

    await page.getByRole('tab', { name: 'Ayarlar sekmesi' }).click()
    await expect(page.getByText('Görünüm ve Geri Bildirim')).toBeVisible()
  })

  test('öğrenme durumu sembol bazlı saklanır (boş durum dürüst)', async ({ page }) => {
    await page.addInitScript(() => {
      window.indexedDB.deleteDatabase('keyval-store')
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Model', exact: true }).click()
    await page.getByRole('tab', { name: 'Hafıza sekmesi' }).click()
    await expect(page.getByRole('region', { name: 'Hafıza' })).toBeVisible()
    await expect(page.getByText('Toplam')).toBeVisible()
  })
})
