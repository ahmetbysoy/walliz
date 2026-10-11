# LANKA v2

Orderbook duvarlarını gerçek zamanlı izleyen, coin bazlı öğrenen, **mobil öncelikli** piyasa ekranı.

- **Gerçek piyasa verisi** — Binance birleşik stream (`depth20@100ms` + `kline` + `ticker`) ve
  REST geçmiş mumları. Simülasyon/mock/yer tutucu katmanı **yoktur**: bağlantı yoksa uygulama
  veri uydurmaz, durumu açıkça bildirir (`CANLI / AÇILIYOR / BAĞLANIYOR / ÇEVRİMDIŞI`).
- **Duvar tespiti** — orderbook'ta olağandışı hacim kümelenmeleri (adaptif eşik, coin bazlı)
- **Öğrenme modeli** — her mum kapanışında yön tahmini; sonuçla karşılaştırıp ağırlıklarını günceller (coin başına, IndexedDB'de kalıcı)
- **Kovalar** — tahmin doğruluğu güven bandına göre bucket'lanır (modelin kalibrasyonu)
- **PWA** — yüklenebilir; çevrimdışıyken uygulama kabuğu açılır ve bağlantı durumu bildirilir.
  Borsa yanıtları **asla** servis çalışanı önbelleğinden sunulmaz (eski fiyatı "canlı" gibi göstermemek için).

Detay: [`docs/SPEC.md`](docs/SPEC.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/MODEL.md`](docs/MODEL.md) · Görev panosu: [`docs/TASKS.md`](docs/TASKS.md)

## Kurulum

```bash
npm install
npm run dev        # http://localhost:5173
```

Uygulama açılışta doğrudan Binance'e bağlanır; internet erişimi yoksa grafik boş kalır ve
arayüz bunu söyler (uydurma veri gösterilmez). Farklı bir uç nokta/proxy kullanmak için
`.env.local` içinde `VITE_BINANCE_WS` / `VITE_BINANCE_REST` tanımlayın.

## Komutlar

| Komut                             | Açıklama                                                  |
| --------------------------------- | --------------------------------------------------------- |
| `npm run dev`                     | Geliştirme sunucusu                                       |
| `npm run build`                   | Tip kontrolü + production build (PWA dahil)               |
| `npm run preview`                 | Production build'i yerel önizle                           |
| `npm run lint`                    | ESLint (flat config + feature-sliced boundary kuralları)  |
| `npm run format` / `format:check` | Prettier                                                  |
| `npm test`                        | Vitest unit + integration                                 |
| `npm run test:coverage`           | Coverage (hedef %70+)                                     |
| `npm run test:e2e`                | Playwright E2E (iPhone 13 / Pixel 5 / Desktop; gerçek ağ) |
| `npm run backtest`                | **Gerçek** Binance kline verisiyle model backtest         |
| `npm run bundle:analyze`          | Bundle analizi (rollup-plugin-visualizer → stats.html)    |
| `npm run icons`                   | PWA ikonlarını yeniden üret (bağımlılıksız PNG üretici)   |

## Ortam Değişkenleri

`.env.example` dosyasına bakın. Tamamı opsiyoneldir; varsayılanlar gerçek Binance uç noktalarıdır:

- `VITE_BINANCE_WS` — birleşik stream (varsayılan `wss://stream.binance.com:9443`)
- `VITE_BINANCE_WS_FALLBACKS` — erişilemezse sırayla denenecek gerçek host'lar
- `VITE_BINANCE_REST` — kline geçmişi (varsayılan `https://api.binance.com`)
- `VITE_BINANCE_REST_FALLBACKS` — REST yedek host'ları

## Mimari Özeti

```
app/        → orkestrasyon (feed döngüsü, wall engine, prediction loop)
features/*  → dikey dilimler; BİRBİRİNE import edemez (eslint ile zorlanıyor)
entities/*  → paylaşılan tipler
shared/     → saf algoritmalar (duvar, feature, model, mum listesi), store'lar, UI kiti, worker
```

Veri akışı: `FeedEvent → marketStore → wallEngine (Web Worker) → walls+features →
predictionEngine (kapalı mum) → learningStore → IndexedDB`.
Detay ve diyagram: `docs/ARCHITECTURE.md`.

Mum listesi her zaman **artan ve tekil** tutulur (`shared/lib/candles.ts`): canlı WS mesajları,
yeniden bağlanma sonrası REST geçmişi ve tekrarlanan paketler aynı listeye karışsa da grafik
motoruna geriye giden zaman gönderilmez.

## Test Stratejisi

- **Unit** (saf): mum listesi kuralları (`upsertCandle`/`mergeHistory`), grafik senkron planı
  (`planChartSync` — "Cannot update oldest data" hatasının imkânsız olduğu senaryolar),
  duvar tespiti, model, normalizasyon, format, migrasyon, buckets
- **Integration**: canlı feed (Binance tel formatı) → store → UI; backoff/host rotasyonu;
  gerçek veri gelmediğinde hiçbir veri üretilmediğinin doğrulanması; tahmin döngüsü
- **Gerçek ağ (opt-in)**: `LANKA_LIVE_NETWORK=1 npm test` → canlı Binance REST'e bağlanıp
  gerçek mumları doğrular
- **E2E** (Playwright): mobil viewport'larda açılış, gerçek fiyat/grafik, çevrimdışı dürüst
  durum, coin/timeframe değişimi, tab navigasyonu, pull-to-refresh
- **Backtest**: `npm run backtest` — gerçek kline verisi (ağ yoksa `KLINES_FILE` ile dosyadan)

## Yayın

Statik build (Vercel/Netlify).

CI: lint → test(coverage) → build → E2E. Workflow dosyası bu oturumda kullanılan
GitHub App'inin `workflows` yetkisi olmadığı için `ci/workflow.yml` altında duruyor —
devreye almak için `ci/workflow.yml` → `.github/workflows/ci.yml` olarak taşıyın.

## Bilinçli Ertelenenler

Light mode toggle, renk körü modu UI (token'lar hazır), Lighthouse CI, Storybook,
Sentry/analytics, Capacitor paketleme — `docs/TASKS.md`'de ⏸ işaretli.
