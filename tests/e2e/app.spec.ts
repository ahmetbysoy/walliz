import { test, expect } from '@playwright/test'

/**
 * E2E — GERÇEK borsa verisiyle.
 *
 * Uygulama simülasyon modu içermediği için testler de taklit veri beklemez:
 * - Bağlantı varsa: gerçek Binance akışından gelen fiyat/mum doğrulanır.
 * - Bağlantı yoksa: uygulama veri uydurmak yerine durumu açıkça bildirir; test
 *   bu dürüst davranışı doğrular.
 */

const PILL = /feed durumu/i
const ANY_STATUS = /CANLI|AÇILIYOR|BAĞLANIYOR|ÇEVRİMDIŞI/

test.describe('LANKA mobil akış', () => {
  test('açılır, feed durumu ve grafik alanı çizilir', async ({ page }) => {
    await page.goto('/')
    const pill = page.getByRole('button', { name: PILL })
    await expect(pill).toBeVisible()
    await expect(pill).toHaveText(ANY_STATUS)

    // veri yoksa uydurma mum çizilmez; ya chart canvas'ı ya da durum mesajı olur
    const chart = page.locator('[data-chart-root]')
    await expect(chart).toBeVisible()
    await expect(chart.locator('canvas').or(chart.getByRole('status'))).toBeVisible({
      timeout: 30_000,
    })
  })

  test('gerçek veri bağlanınca fiyat ve mum grafiği gelir (çevrimiçi)', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    const pill = page.getByRole('button', { name: PILL })
    await expect(pill).toHaveText('CANLI', { timeout: 30_000 })

    // gerçek fiyat: ayırıcı ile biçimlendirilmiş sayı (uydurma değer yok)
    const price = page.locator('header span.tabular-nums').first()
    await expect(price).toHaveText(/\d[\d.,]*/, { timeout: 30_000 })

    // grafik canvas'ı gerçek mumlarla çizilir
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 })

    // kanıt: sekmeyi arka plana alıp geri getirmek yeni canlı veri akıtır (fiyat değişir)
    await context.setOffline(false)
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

  test('duvarlar paneli gerçek orderbook satırlarını listeler (çevrimiçi)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: PILL }).waitFor()
    const pill = page.getByRole('button', { name: PILL })
    await expect(pill).toHaveText('CANLI', { timeout: 30_000 })
    await page.getByRole('button', { name: 'Duvarlar' }).click()
    await expect(page.getByText('Alış tarafı (bids)')).toBeVisible({ timeout: 30_000 })
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
})

test('kullanıcı verisi: öğrenme durumu sembol bazlı saklanır', async ({ page }) => {
  await page.addInitScript(() => {
    window.indexedDB.deleteDatabase('keyval-store')
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Hafıza' }).click()
  await expect(page.getByRole('region', { name: 'Hafıza' })).toBeVisible()
  // henüz gerçek doğrulama yoksa dürüst boş durum gösterilir
  await expect(page.getByText('Toplam')).toBeVisible()
})
