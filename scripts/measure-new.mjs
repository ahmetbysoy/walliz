import { chromium } from 'playwright'
import fs from 'fs'

const SPARTICUZ_ARGS = [
  '--ash-no-nudges',
  '--disable-domain-reliability',
  '--disable-print-preview',
  '--disk-cache-size=33554432',
  '--no-default-browser-check',
  '--no-pings',
  '--single-process',
  '--font-render-hinting=none',
  '--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process',
  '--enable-features=SharedArrayBuffer',
  '--ignore-gpu-blocklist',
  '--in-process-gpu',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--allow-running-insecure-content',
  '--disable-setuid-sandbox',
  '--disable-site-isolation-trials',
  '--disable-web-security',
  '--headless=shell',
  '--no-sandbox',
  '--no-zygote',
]

async function measure() {
  const viewports = [
    { name: '390x844', width: 390, height: 844, desc: 'iPhone 13 (dikey)' },
    { name: '360x640', width: 360, height: 640, desc: 'Kucuk Android (dikey)' },
    { name: '844x390', width: 844, height: 390, desc: 'iPhone 13 (yatay / landscape)' },
  ]

  const results = []

  for (const vp of viewports) {
    const browser = await chromium.launch({
      executablePath: '/tmp/chromium',
      args: SPARTICUZ_ARGS,
    })

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    })
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:4173/')
    await page.waitForSelector('header')
    await page.waitForTimeout(500)

    const headerBox = await page.locator('header').boundingBox()
    const statsBox = await page.locator('[role="region"][aria-label="Piyasa istatistikleri"]').boundingBox()
    const chartBox = await page.locator('[data-chart-root]').boundingBox()
    const canvasContainerBox = await page.locator('[data-chart-root] > div:last-child').boundingBox()
    const navBox = await page.locator('nav').boundingBox()
    const predBox = await page.locator('button[aria-label^="Model tahmini"]').boundingBox()

    const screenshotPath = `tests/e2e/__screenshots__/new-${vp.name}.png`
    await page.screenshot({ path: screenshotPath, fullPage: false })

    const chartTop = chartBox ? chartBox.y : 0
    const chartHeight = chartBox ? chartBox.height : 0
    const chartBottom = chartBox ? chartBox.y + chartBox.height : 0
    const navTop = navBox ? navBox.y : 0
    const predTop = predBox ? predBox.y : 0
    const predBottom = predBox ? predBox.y + predBox.height : 0

    const predVisible = predBox && navTop ? predBottom <= navTop && predTop < vp.height : false
    const chartOverlapsNav = chartBottom && navTop ? chartBottom > navTop : false

    results.push({
      vp,
      headerBox,
      statsBox,
      chartBox,
      canvasContainerBox,
      navBox,
      predBox,
      chartTop,
      chartHeight,
      chartBottom,
      navTop,
      predTop,
      predBottom,
      chartOverlapsNav,
      predVisible,
      screenshotPath,
    })

    await browser.close()
  }

  console.log('New Measurements complete! Results:', JSON.stringify(results, null, 2))
}

measure().catch(console.error)
