# GitHub Actions & Codespaces — ne nerede çalışır

Bu klasördeki iş akışları **hazır** ama `.github/workflows/` altına konulamadı: bu oturumda
kullanılan GitHub App'inin `workflows` izni yok ve GitHub App'ler bu izin olmadan
`.github/workflows/*` dosyası **push edemiyor**:

```
refusing to allow a GitHub App to create or update workflow `.github/workflows/...`
without `workflows` permission
```

## Devreye alma (3 yol, biri yeterli)

| Yol                       | Yapan                                                                    | Süre  | Sonuç                                                      |
| ------------------------- | ------------------------------------------------------------------------ | ----- | ---------------------------------------------------------- |
| **A. Script**             | Siz: `bash ci/enable-actions.sh` + `git push`                            | 10 sn | İş akışları kalıcı olarak devrede                          |
| **B. İzin ver**           | GitHub → Settings → Applications → (App) → **Workflows: Read and write** | 1 dk  | Bundan sonra ajan da iş akışlarını kendisi güncelleyebilir |
| **C. Arayüzden yapıştır** | GitHub → Actions → New workflow → "set up a workflow yourself"           | 2 dk  | Tek seferlik; dosya repoda kalıcı                          |

En verimlisi **B**: izin verilirse sonraki turlarda CI'ı ben bakımını yapabilirim.

## İş akışları

### `ci.yml` — her push ve PR'da

- **quality**: `npm ci` → lint → format check → `test:coverage` (eşik %70) → build → kapsam artifact'i
- **e2e**: Chromium kurulumu → borsa erişimini **yoklar** → Playwright (iPhone 13 / Pixel 5 / Desktop)
  - Erişim varsa: `VITE_BINANCE_REST` gerçek erişilebilir host'a ayarlanır, akış testleri koşar.
  - Erişim yoksa (ör. US koşucularında `api.binance.com` → 451): testler uydurma veri beklemez,
    çevrimdışı dürüstlük testleri koşar ve koşu özetine `⚠️` notu düşülür.
  - `concurrency.cancel-in-progress` ile aynı dalda kuyruk birikmez.

### `market-watch.yml` — günde bir (05:10 UTC) + elle tetikleme

Gerçek veriyle **sürekli doğrulama**; burada "iş yükü Actions'ta" gerçekten anlamlı:

1. Borsa host'larını yoklar (`api.binance.com`, `data-api.binance.vision`).
2. `LANKA_LIVE_NETWORK=1 npx vitest run tests/integration/realBinance.test.ts`
   → canlı Binance yanıtının bizim ayrıştırıcıyla uyumunu doğrular (tel formatı sözleşmesi).
3. `SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT npm run backtest` → gerçek klines ile model taraması,
   `market-watch-report.json` artifact'i + iş özetine markdown tablo.
4. Borsaya erişilemezse: **hiçbir sonuç uydurulmaz**; koşu `⚠️` uyarısı ve "gerçek veri
   doğrulaması yapılamadı" notuyla biter.
5. Elle tetiklemede sembol/aralık/mum sayısı girdi olarak verilebilir.

> Not: `api.binance.com` ABD koşucularından 451 dönebilir; `data-api.binance.vision`
> (herkese açık piyasa verisi CDN'i) genelde erişilebilir. İş akışı ikisini de dener.

### `deploy-pages.yml` — GitHub Pages'e yayın

- `main`'e push'ta (ve elle) çalışır: kalite kapıları → `VITE_BASE_PATH=/<repo>/` ile build →
  `.nojekyll` → `actions/upload-pages-artifact` → `actions/deploy-pages`.
- Gerekli ayar: **Settings → Pages → Source: GitHub Actions**.
- İzin gerektirmeyen alternatif: `bash scripts/deploy-pages.sh` (dist'i `gh-pages` dalına
  push eder; Settings → Pages → Source: Deploy from a branch → `gh-pages` / root).

> Sayfa alt dizinden servis edildiği için taban yol (**base path**) şart. `vite.config.ts`
> `VITE_BASE_PATH` ile bunu destekler; PWA manifest `start_url`/`scope` ve service worker
> `navigateFallback` de aynı tabana göre üretilir. Kök alan adına (Vercel, custom domain)
> kurulacaksa `VITE_BASE_PATH=/` yeterlidir.

## Codespaces

`.devcontainer/devcontainer.json` hazır: Node 22, GitHub CLI, ESLint/Prettier/Tailwind/
Playwright eklentileri, 5173 ve 4173 portları otomatik yönlendirilir, `postCreateCommand: npm ci`.

Açma: repo → **Code** → **Codespaces** → **Create codespace on …** (bölge olarak
**WestEurope** seçin; İstanbul'a en yakın ve borsa erişimi açısından en güvenilir bölge).

Codespace'te tipik işler:

```bash
npm run dev                            # uygulamayı codespace içinde çalıştır (port otomatik açılır)
npx playwright install --with-deps chromium
npm run test:e2e                       # gerçek tarayıcıyla E2E
LANKA_LIVE_NETWORK=1 npm test          # canlı borsa sözleşme testi
npm run backtest                       # gerçek kline ile backtest
npx lighthouse http://localhost:4173 --view   # performans/erişilebilirlik ölçümü
```

## İş bölümü (önerilen)

| Ortam              | Ne için                                                               | Neden                                                                         |
| ------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Ajan sandbox'ı** | kod yazımı, birim/entegrasyon testleri, hızlı döngü                   | dosya araçları ve anlık görüntüler burada; en hızlı geri bildirim             |
| **GitHub Actions** | kalite kapıları, E2E, günlük gerçek-veri doğrulaması, artifact'ler    | tarayıcılı koşucu + zamanlanmış iş yükü; repoda kanıt kalır                   |
| **Codespaces**     | tarayıcıda elle QA, Lighthouse, mobil cihaz testi, Playwright UI mode | etkileşimli; ajan buradan uzaktan komut çalıştırabilir ama dosya araçları yok |
