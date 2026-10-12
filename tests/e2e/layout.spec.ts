import { test, expect } from '@playwright/test'

/**
 * E2E Layout & Geometry Testleri — T-P3-3
 *
 * Mobil ekran bütçesi ve dokunmatik hedeflerin geometrik doğrulaması.
 */

test.describe('Mobil Ekran Bütçesi ve Düzen Doğrulaması', () => {
  test('390×844 dikey: header ≤56px, istatistik tek satır, grafik ≥%45, tahmin şeridi nav üstünde', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.waitForSelector('header')

    const headerBox = await page.locator('header').boundingBox()
    expect(headerBox).not.toBeNull()
    expect(headerBox!.height).toBeLessThanOrEqual(56)

    const statsBox = await page
      .locator('[role="region"][aria-label="Piyasa istatistikleri"]')
      .boundingBox()
    expect(statsBox).not.toBeNull()
    expect(statsBox!.height).toBeLessThanOrEqual(32)

    const chartBox = await page.locator('[data-chart-root]').boundingBox()
    expect(chartBox).not.toBeNull()

    // Grafik canvas üstü ≤ viewport yüksekliğinin %30'u (≤ 253.2px)
    expect(chartBox!.y).toBeLessThanOrEqual(844 * 0.3)

    // Grafik canvas yüksekliği ≥ viewport'un %45'i (≥ 379.8px)
    expect(chartBox!.height).toBeGreaterThanOrEqual(844 * 0.45)

    const navBox = await page.locator('nav').boundingBox()
    expect(navBox).not.toBeNull()

    const predBox = await page.locator('button[aria-label^="Model tahmini"]').boundingBox()
    expect(predBox).not.toBeNull()

    // Canvas ve PredictionCard şeridi tamamen bottom-nav'ın üstünde görünür
    expect(predBox!.y + predBox!.height).toBeLessThanOrEqual(navBox!.y)
    expect(chartBox!.y + chartBox!.height).toBeLessThanOrEqual(predBox!.y)
  })

  test('360×640 dikey: canvas yüksekliği ≥260px ve nav ile çakışmaz', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await page.goto('/')
    await page.waitForSelector('header')

    const chartBox = await page.locator('[data-chart-root]').boundingBox()
    expect(chartBox).not.toBeNull()
    expect(chartBox!.height).toBeGreaterThanOrEqual(260)

    const navBox = await page.locator('nav').boundingBox()
    expect(navBox).not.toBeNull()

    const predBox = await page.locator('button[aria-label^="Model tahmini"]').boundingBox()
    expect(predBox).not.toBeNull()

    // nav ile çakışmaz (prediction card ve chart tamamen nav'ın üstünde)
    expect(predBox!.y + predBox!.height).toBeLessThanOrEqual(navBox!.y)
  })

  test('844×390 yatay: header ince (≤40px), nav ince (≤40px), çakışma yok', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await page.goto('/')
    await page.waitForSelector('header')

    const headerBox = await page.locator('header').boundingBox()
    expect(headerBox).not.toBeNull()
    expect(headerBox!.height).toBeLessThanOrEqual(40)

    const navBox = await page.locator('nav').boundingBox()
    expect(navBox).not.toBeNull()
    expect(navBox!.height).toBeLessThanOrEqual(40)

    const predBox = await page.locator('button[aria-label^="Model tahmini"]').boundingBox()
    expect(predBox).not.toBeNull()
    expect(predBox!.y + predBox!.height).toBeLessThanOrEqual(navBox!.y)
  })

  test('T-P1-7: Dokunmatik hedefler minimum boyut kuralına uyar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    // Nav butonları ≥44x44
    const navButtons = page.locator('nav button')
    const count = await navButtons.count()
    expect(count).toBe(3)
    for (let i = 0; i < count; i++) {
      const box = await navButtons.nth(i).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }

    // Timeframe sekmeleri
    const tfTabs = page.locator('[role="tablist"] [role="tab"]')
    const tfCount = await tfTabs.count()
    for (let i = 0; i < tfCount; i++) {
      const box = await tfTabs.nth(i).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(32) // Toolbar chip compact height
    }
  })

  test('T-P0-5: Tahmin şeridine tıklanınca detay Bottom Sheet açılır ve kapanır', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const predButton = page.locator('button[aria-label^="Model tahmini"]')
    await expect(predButton).toBeVisible()
    await predButton.click()

    // Modal açılır
    const modal = page.locator('[role="dialog"][aria-label="Model Tahmin Detayı"]')
    await expect(modal).toBeVisible()
    await expect(modal.getByText('Model Tahmin Detayı')).toBeVisible()

    // Kapat butonu ile kapanır
    await modal.getByRole('button', { name: 'Kapat' }).click()
    await expect(modal).toBeHidden()
  })

  test('T-P1-3: Tanıtım rehberi (Onboarding) 3 kartı gösterir ve kapatılabilir', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    await page.getByRole('button', { name: 'Rehber ve yardım' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // 1. kart
    await expect(dialog.getByText('1. Duvar Nedir?')).toBeVisible()
    await dialog.getByRole('button', { name: 'İleri' }).click()

    // 2. kart
    await expect(dialog.getByText('2. Sinyal Gücü Ne Demek?')).toBeVisible()
    await dialog.getByRole('button', { name: 'İleri' }).click()

    // 3. kart
    await expect(dialog.getByText('3. Nasıl Okunur?')).toBeVisible()
    await dialog.getByRole('button', { name: 'Anladım' }).click()

    await expect(dialog).toBeHidden()
  })
})
