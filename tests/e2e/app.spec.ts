import { test, expect, type Page } from '@playwright/test'

/**
 * E2E — GERÇEK borsa verisiyle.
 *
 * Uygulama simülasyon modu içermediği için testler de taklit veri beklemez:
 * - Borsa erişilebilirse: gerçek akıştan gelen fiyat/mum/kitap doğrulanır.
 * - Erişilemezse (ör. CI koşucusunun bölgesi engelli): akış testleri **atlanır** ve
 *   yalnızca "veri uydurulmadığı" davranışı doğrulanır. Böylece kırmızı bir CI,
 *   gerçek bir regresyonu işaret eder — ağ engelini değil.
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

    // veri yoksa uydurma mum çizilmez; ya chart canvas'ı ya da dürüst durum mesajı olur
    const chart = page.locator('[data-chart-root]')
    await expect(chart).toBeVisible()
    await expect(chart.locator('canvas').or(chart.getByRole('status'))).toBeVisible({
      timeout: 30_000,
    })
  })

  test('gerçek veri bağlanınca fiyat ve grafik gelir (borsa erişilebilirse)', async ({ page }) => {
    await page.goto('/')
    const host = await reachableRestHost(page)
    test.skip(host === null, 'Bu koşucudan gerçek borsa uç noktalarına erişilemiyor')

    const pill = page.getByRole('button', { name: PILL })
    await expect(pill).toHaveText('CANLI', { timeout: 30_000 })

    // gerçek fiyat: biçimlendirilmiş sayı (uydurma değer yok, akıştan gelir)
    const price = page.locator('header span.tabular-nums').first()
    await expect(price).toHaveText(/\d[\d.,]*/, { timeout: 30_000 })

    // grafik canvas'ı gerçek mumlarla çizilir
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

  test('çevrimdışı: uygulama veri uydurmaz, durumu bildirir', async ({ browser }) => {
    const context = await browser.newContext()
    await context.setOffline(true)
    const page = await context.newPage()
    await page.goto('/')

    const pill = page.getByRole('button', { name: PILL })
    await expect(pill).toHaveText('ÇEVRİMDIŞI', { timeout: 30_000 })
    await expect(page.getByRole('alert')).toContainText('Canlı piyasa verisine ulaşılamıyor')
    // grafik alanında mum yerine açıklama + yeniden bağlan butonu
    await expect(page.getByRole('button', { name: 'Yeniden bağlan' })).toBeVisible()
    // header'da uydurma fiyat yok
    const priceSpans = page.locator('header span.tabular-nums')
    const count = await priceSpans.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) await expect(priceSpans.nth(i)).toHaveText('—')
    await context.close()
  })

  test('coin değiştirince header güncellenir', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Coin seç' }).click()
    await page.getByRole('option', { name: /Dogecoin/i }).click()
    await expect(page.locator('header')).toContainText('Dogecoin')
  })

  test('timeframe chip değiştirilebilir', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('tab', { name: '5m mum' }).click()
    await expect(page.getByRole('tab', { name: '5m mum' })).toHaveAttribute('aria-selected', 'true')
  })

  test('tab navigasyonu panelleri açar', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Duvarlar' }).click()
    await expect(page.getByRole('region', { name: 'Duvarlar' })).toBeVisible()

    await page.getByRole('button', { name: 'Kovalar' }).click()
    await expect(page.getByRole('region', { name: 'Kovalar' })).toBeVisible()

    await page.getByRole('button', { name: 'Hafıza' }).click()
    await expect(page.getByRole('region', { name: 'Hafıza' })).toBeVisible()
    await expect(page.getByText('Ağırlıklar')).toBeVisible()
  })

  test('çekince yenilenir (pull-to-refresh) ve bağlantı durumu korunur', async ({ page }) => {
    await page.goto('/')
    const pill = page.getByRole('button', { name: PILL })
    await expect(pill).toHaveText(ANY_STATUS)

    // grafik panelinde değil, listede çekiyoruz (grafik kendi jest alanını yönetir)
    await page.getByRole('button', { name: 'Hafıza' }).click()
    const box = await page.locator('main').boundingBox()
    if (!box) throw new Error('main bulunamadı')
    await page.mouse.move(box.x + box.width / 2, box.y + 40)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + 260, { steps: 12 })
    await page.mouse.up()

    await expect(page.getByRole('status', { name: 'Yenileniyor' })).toBeVisible()
    await expect(pill).toHaveText(ANY_STATUS)
  })

  test('öğrenme durumu sembol bazlı saklanır (boş durum dürüst)', async ({ page }) => {
    await page.addInitScript(() => {
      window.indexedDB.deleteDatabase('keyval-store')
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Hafıza' }).click()
    await expect(page.getByRole('region', { name: 'Hafıza' })).toBeVisible()
    await expect(page.getByText('Toplam')).toBeVisible()
  })
})
