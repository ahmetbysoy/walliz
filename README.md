# LANKA v2

Orderbook duvarlarını gerçek zamanlı izleyen, coin bazlı öğrenen, **mobil öncelikli** piyasa ekranı.

- **Duvar tespiti** — orderbook'ta olağandışı hacim kümelenmeleri (adaptif eşik, coin bazlı)
- **Öğrenme modeli** — her mum kapanışında yön tahmini; sonuçla karşılaştırıp ağırlıklarını günceller (coin başına, IndexedDB'de kalıcı)
- **Kovalar** — tahmin doğruluğu güven bandına göre bucket'lanır (modelin kalibrasyonu)
- **Demo modu** — canlı veri yoksa deterministik (seed'li) feed'e düşer; UI'da `DEMO` olarak açıkça gösterilir
- **PWA** — yüklenebilir, offline'da demo modda çalışır

Detay: [`docs/SPEC.md`](docs/SPEC.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/MODEL.md`](docs/MODEL.md) · Görev panosu: [`docs/TASKS.md`](docs/TASKS.md)

## Kurulum

```bash
npm install
npm run dev        # http://localhost:5173
```

> Sandbox/offline ortamlarda uygulamayı demo modda çalıştırmak için `.env.local` dosyası
> oluşturun: `VITE_DEMO_MODE=1`

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Tip kontrolü + production build (PWA dahil) |
| `npm run preview` | Production build'i yerel önizle |
| `npm run lint` | ESLint (flat config + feature-sliced boundary kuralları) |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Vitest unit + integration (125 test) |
| `npm run test:coverage` | Coverage (hedef %70+, şu an ~%82) |
| `npm run test:e2e` | Playwright E2E (iPhone 13 / Pixel 5 / Desktop; demo modda) |
| `npm run backtest` | Sentetik seri üzerinde model backtest |
| `npm run bundle:analyze` | Bundle analizi (rollup-plugin-visualizer → stats.html) |
| `npm run icons` | PWA ikonlarını yeniden üret (bağımlılıksız PNG üretici) |

## Ortam Değişkenleri

`.env.example` dosyasına bakın. Önemlileri:

- `VITE_DEMO_MODE=1` — demo feed'i zorla (test/offline)
- `VITE_BINANCE_WS` — birleşik stream (varsayılan `wss://stream.binance.com:9443`)
- `VITE_BINANCE_REST` — kline geçmişi (varsayılan `https://api.binance.com`)
- `VITE_DEMO_SEED` — demo determinizmi (boşsa symbol+timeframe hash)

## Mimari Özeti

```
app/        → orkestrasyon (feed döngüsü, wall engine, prediction loop)
features/*  → dikey dilimler; BİRBİRİNE import edemez (eslint ile zorlanıyor)
entities/*  → paylaşılan tipler
shared/     → saf algoritmalar (duvar, feature, model), store'lar, UI kiti, worker
```

Veri akışı: `FeedEvent → marketStore → wallEngine (Web Worker) → walls+features →
predictionEngine (kapalı mum) → learningStore → IndexedDB`.
Detay ve diyagram: `docs/ARCHITECTURE.md`.

## Test Stratejisi

- **Unit** (saf): duvar tespiti, model, normalizasyon, format, RNG, migrasyon, buckets
- **Integration**: demo feed → store → UI; mock WebSocket → backoff → demo fallback; tahmin döngüsü
- **E2E** (Playwright): mobil viewport'larda açılış, coin/timeframe değişimi, tab navigasyonu, offline→demo
- **Backtest**: `npm run backtest`

## Yayın

Statik build (Vercel/Netlify). CI: lint → test(coverage) → build → E2E (`.github/workflows/ci.yml`).

## Bilinçli Ertelenenler

Light mode toggle, renk körü modu UI (token'lar hazır), Lighthouse CI, Storybook,
Sentry/analytics, Capacitor paketleme — `docs/TASKS.md`'de ⏸ işaretli.
