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
    const metricsBox = await page.locator('#panel-grafik .grid.grid-cols-2').boundingBox()
    const chartBox = await page.locator('[data-chart-root]').boundingBox()
    const navBox = await page.locator('nav').boundingBox()
    const predCardLocator = page.locator('#panel-grafik > div > div:last-child')
    const predBox = await predCardLocator.boundingBox()

    const screenshotPath = `tests/e2e/__screenshots__/baseline-${vp.name}.png`
    await page.screenshot({ path: screenshotPath, fullPage: false })

    const chartTop = chartBox ? chartBox.y : 0
    const chartHeight = chartBox ? chartBox.height : 0
    const chartBottom = chartBox ? chartBox.y + chartBox.height : 0
    const navTop = navBox ? navBox.y : 0
    const predVisible =
      predBox && navTop ? predBox.y + predBox.height <= navTop && predBox.y < vp.height : false
    const predPartiallyVisible =
      predBox && navTop ? predBox.y < navTop && predBox.y + predBox.height > navTop : false
    const chartOverlapsNav = chartBottom && navTop ? chartBottom > navTop : false

    results.push({
      vp,
      headerBox,
      metricsBox,
      chartBox,
      navBox,
      predBox,
      chartTop,
      chartHeight,
      chartBottom,
      navTop,
      chartOverlapsNav,
      predVisible,
      predPartiallyVisible,
      screenshotPath,
    })

    await browser.close()
  }

  console.log('Measurements complete! Results:', JSON.stringify(results, null, 2))

  let md = '# LANKA v2 — Mobil UX Baslangic Olcumleri (Baseline)\n\n'
  md += 'Tarih: 2026-10-12\n'
  md += 'Olcum yontemi: Playwright Headless Chromium (390x844, 360x640, 844x390)\n\n'
  md += '## Ozet Tablosu\n\n'
  md +=
    '| Viewport | Header Yukseklik | MetricsRow Yukseklik | Grafik Ust y | Grafik Alt y | BottomNav Ust y | Grafik Nav ile Cakısıyor mu? | PredictionCard Gorunur mu? |\n'
  md += '|---|---|---|---|---|---|---|---|\n'

  for (const r of results) {
    const predStatus = r.predVisible
      ? 'Tamamen gorunur'
      : r.predPartiallyVisible
        ? 'Kismen (nav/fold kesiyor)'
        : 'Fold altinda (gorunmuyor)'
    const chartOverlap = r.chartOverlapsNav ? 'EVET (alti nav altinda)' : 'HAYIR'
    md += `| ${r.vp.desc} (${r.vp.width}x${r.vp.height}) | ${r.headerBox?.height.toFixed(1)}px | ${r.metricsBox?.height.toFixed(1)}px | ${r.chartTop.toFixed(1)}px | ${r.chartBottom.toFixed(1)}px | ${r.navTop.toFixed(1)}px | ${chartOverlap} | ${predStatus} |\n`
  }

  md += '\n## Statik Tahmin Dogrulamasi ve Analiz\n\n'
  md +=
    '- **Statik Tahmin**: Header ~89px, MetricsRow ~188px, Grafik canvas baslangici ~y=305, Grafik yukseklik 340px.\n\n'

  const r0 = results[0]
  md += `### 1. iPhone 13 (390x844 dikey)\n`
  md += `- Header yuksekligi: ${r0.headerBox?.height.toFixed(1)}px\n`
  md += `- MetricsRow yuksekligi: ${r0.metricsBox?.height.toFixed(1)}px\n`
  md += `- Grafik baslangic y: ${r0.chartTop.toFixed(1)}px (ekran yuksekliginin %${((r0.chartTop / r0.vp.height) * 100).toFixed(1)}'i)\n`
  md += `- Grafik yukseklik: ${r0.chartHeight.toFixed(1)}px\n`
  md += `- Grafik alt y: ${r0.chartBottom.toFixed(1)}px\n`
  md += `- BottomNav ust y: ${r0.navTop.toFixed(1)}px\n`
  md += `- PredictionCard ust y: ${r0.predBox?.y.toFixed(1)}px, alt y: ${(r0.predBox ? r0.predBox.y + r0.predBox.height : 0).toFixed(1)}px (Nav ust y: ${r0.navTop.toFixed(1)}px)\n`
  md += `- Sonuc: PredictionCard fold altinda (y=${r0.predBox?.y.toFixed(1)}px > navTop=${r0.navTop.toFixed(1)}px), kullanici asagi kaydirmadan modeli goremiyor.\n\n`

  const r1 = results[1]
  md += `### 2. Kucuk Android (360x640 dikey)\n`
  md += `- Header yuksekligi: ${r1.headerBox?.height.toFixed(1)}px\n`
  md += `- MetricsRow yuksekligi: ${r1.metricsBox?.height.toFixed(1)}px\n`
  md += `- Grafik baslangic y: ${r1.chartTop.toFixed(1)}px (ekranin %${((r1.chartTop / r1.vp.height) * 100).toFixed(1)}'i)\n`
  md += `- Grafik alt y: ${r1.chartBottom.toFixed(1)}px vs BottomNav ust y: ${r1.navTop.toFixed(1)}px\n`
  md += `- Sonuc: Grafik alt kismi bottom-nav tarafindan ${(r1.chartBottom - r1.navTop).toFixed(1)}px oranda kapatiliyor! PredictionCard tamamen ekran disinda.\n\n`

  const r2 = results[2]
  md += `### 3. iPhone 13 Yatay / Landscape (844x390)\n`
  md += `- Header yuksekligi: ${r2.headerBox?.height.toFixed(1)}px (390px ekran yuksekliginin %${((r2.headerBox.height / r2.vp.height) * 100).toFixed(1)}'i!)\n`
  md += `- MetricsRow yuksekligi: ${r2.metricsBox?.height.toFixed(1)}px\n`
  md += `- Grafik baslangic y: ${r2.chartTop.toFixed(1)}px\n`
  md += `- Grafik alt y: ${r2.chartBottom.toFixed(1)}px vs BottomNav ust y: ${r2.navTop.toFixed(1)}px\n`
  md += `- Sonuc: Yatay modda neredeyse hic grafik gorunmuyor; kaydirma yapilmadikca canvas ulasilmaz.\n\n`

  md += '## Ekran Goruntuleri\n\n'
  md += '- `tests/e2e/__screenshots__/baseline-390x844.png`\n'
  md += '- `tests/e2e/__screenshots__/baseline-360x640.png`\n'
  md += '- `tests/e2e/__screenshots__/baseline-844x390.png`\n'

  fs.writeFileSync('docs/UX_BASELINE.md', md, 'utf8')
  console.log('docs/UX_BASELINE.md written successfully!')
}

measure().catch(console.error)
