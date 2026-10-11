import { test, expect } from '@playwright/test'

// E2E demo modda çalışır (playwright.config webServer env: VITE_DEMO_MODE=1)

test.describe('LANKA mobil akış', () => {
  test('açılır, DEMO modda fiyat gösterir, grafik canvas çıkar', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /feed durumu/i })).toHaveText('DEMO')
    const price = page.locator('header').getByText(/USDT|—/)
    await expect(page.locator('header span').first()).not.toHaveText('')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })
    await expect(price).toBeAttached()
  })

  test('coin değiştirince header güncellenir', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /feed durumu/i })).toHaveText('DEMO')
    await page.getByRole('button', { name: 'Coin seç' }).click()
    await page.getByRole('option', { name: /Dogecoin/i }).click()
    await expect(page.locator('header')).toContainText('Dogecoin')
  })

  test('timeframe chip değiştirilebilir', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('tab', { name: '5m mum' }).click()
    await expect(page.getByRole('tab', { name: '5m mum' })).toHaveAttribute('aria-selected', 'true')
  })

  test('tab navigasyonu: duvarlar paneli orderbook satırları gösterir', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Duvarlar' }).click()
    await expect(page.getByRole('region', { name: 'Duvarlar' })).toBeVisible()
    await expect(page.getByText('Alış tarafı (bids)')).toBeVisible()
    await page.getByRole('button', { name: 'Hafıza' }).click()
    await expect(page.getByRole('region', { name: 'Hafıza' })).toBeVisible()
    await expect(page.getByText('Ağırlıklar')).toBeVisible()
  })

  test('tahmin döngüsü: ilk mum kapanışında model kartı aktif olur (demo hızlandırılmış)', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByRole('region', { name: 'Grafik' })).toBeVisible()
    await expect(page.getByText('Model Tahmini')).toBeVisible({ timeout: 30_000 })
  })

  test('offline açılış → demo modda çalışır', async ({ page, context }) => {
    await context.setOffline(true)
    await page.goto('/')
    await expect(page.getByRole('button', { name: /feed durumu/i })).toHaveText('DEMO')
  })
})
