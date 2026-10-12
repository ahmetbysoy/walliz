# LANKA v2 — Teknik Spesifikasyon (Kararlı Versiyon)

> Orderbook duvarlarını gerçek zamanlı izleyen, coin bazlı öğrenen, **mobil öncelikli** piyasa ekranı.
> Bu doküman, orijinal brief'in kararlar alınmış hâlidir. Görev takibi için `docs/TASKS.md`,
> mimari için `docs/ARCHITECTURE.md`, model matematiği için `docs/MODEL.md`.

## 0. Vizyon

- Duvar (wall) tespiti: orderbook'te olağandışı hacim kümelenmelerini gerçek zamanlı bulur.
- Öğrenme: her mum kapanışında yön tahmini yapar, sonuçla karşılaştırır, ağırlıklarını günceller (coin başına).
- Kovalar (pyramid): tahmin doğruluğunu güven aralığına göre bucket'lar; "modelin kendine güveni ne kadar güvenilir?" sorusuna cevap verir.
- Gerçek veri: uygulama yalnızca gerçek borsa akışıyla (Binance WS + REST) çalışır.
  Simülasyon/mock/yer tutucu veri YOKTUR; bağlantı yoksa arayüz bunu açıkça bildirir.

**Hedef kitle:** mobilde hızlı bakan trader'lar. Masaüstü ikincil.

## 1. Stack Kararları

| Alan         | Karar                                                                                        | Neden                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Çekirdek     | **Vite 5 + React 18 + TypeScript (strict)**                                                  | SSR gereksiz; PWA statik çalışır. Next ek ağırlık.                                                             |
| State        | **Zustand v5**                                                                               | Hafif, selector'lı, test edilebilir. Redux Toolkit: KULLANILMIYOR.                                             |
| Server state | **TanStack Query v5**                                                                        | Sadece REST kline geçmişinde; canlı veri ham WS üzerinden.                                                     |
| Router       | **Yok** (tek sayfa + tab)                                                                    | Gereksiz bağımlılık.                                                                                           |
| Stil         | **Tailwind CSS v4** + tailwind-merge + clsx                                                  | CSS değişkenleri (`--mint`, `--coral`, `--violet`, `--bg`) `@theme inline` ile map edilir.                     |
| UI kiti      | **Radix** (Select, Dialog, Tabs, Collapsible) + **vaul** (bottom sheet) + **Sonner** (toast) | shadcn kalıbı, ama CLI yerine elle küçük sarmalayıcılar (registry erişimi yok).                                |
| Animasyon    | **Framer Motion**                                                                            | Sheet/toast/sinyal animasyonları; `useReducedMotion` desteği.                                                  |
| İkon         | **lucide-react**                                                                             | Emoji ikonlar kaldırıldı.                                                                                      |
| Grafik       | **lightweight-charts v4**                                                                    | Mum grafiği + dokunmatik zoom/pan native. Recharts/Chart.js: KULLANILMIYOR.                                    |
| Validasyon   | **zod v3**                                                                                   | WS mesaj şemaları; geçersiz mesaj → log, stream düşmez.                                                        |
| Sayı         | **decimal.js-light**                                                                         | Orderbook satır parse/toplamlarında float hatası riski.                                                        |
| Kalıcılık    | **idb-keyval (IndexedDB)**                                                                   | localStorage yerine; v1→v2 migrasyonu var.                                                                     |
| Gestür       | **@use-gesture/react**                                                                       | Swipe, pull-to-refresh, long-press (elde hook).                                                                |
| PWA          | **vite-plugin-pwa** (workbox)                                                                | Manifest + SW; uygulama kabuğu önbellekte, borsa yanıtları **NetworkOnly** (eski veri canlı gibi gösterilmez). |
| Test         | **Vitest + Testing Library** (unit/integration), **Playwright** (E2E)                        | Coverage hedefi %70+.                                                                                          |
| Lint         | **ESLint 9 (flat) + Prettier + eslint-plugin-boundaries**                                    | Feature sınırları zorlanıyor.                                                                                  |
| Zaman        | **Intl (cache'li)**                                                                          | date-fns gerek kalmadı; `Intl.NumberFormat` modül seviyesinde cache.                                           |
| Worker       | **Web Worker (Vite module worker)**                                                          | Duvar tespiti + feature hesabı; inline fallback (test/SSR).                                                    |

**Kaçınılanlar:** Redux Toolkit, Recharts/Chart.js, MUI/AntD, Socket.io, Moment.js,
ham localStorage, render başına Intl.NumberFormat, main thread'de ağır hesap, sabit reconnect.

## 2. Klasör Yapısı (Feature-Sliced)

```
src/
├── app/                 # entry, providers, shell, feed/engine orkestrasyon hook'ları
├── entities/            # paylaşılan tipler (market, orderbook, prediction) — fonksiyon YOK
├── features/
│   ├── market-feed/     # canlı WS+REST feed (gerçek veri) + StatusPill
│   ├── orderbook/       # kitap + duvar UI (saf algoritmalar shared/lib'de)
│   ├── chart/           # lightweight-charts sarmalayıcı + senkron planı (lib/chartSync)
│   ├── pyramid/         # kovalar (bucket) UI
│   ├── prediction/      # tahmin motoru orkestrasyonu + sinyal UI
│   ├── learning-memory/ # kalıcılık UI + export/import
│   └── preferences/     # coin / timeframe seçicileri
├── shared/
│   ├── config/          # COINS, TIMEFRAMES, env (ws/rest base), duvar sabitleri
│   ├── lib/             # format, math, book, klines, candles, walls, features, model, buckets, repo, wallEngine
│   ├── model/           # marketStore + learningStore (zustand) — cross-feature state
│   ├── ui/              # Button, Card, MetricCard, Sheet, Select, Tabs, Skeleton, EmptyState, ConfidenceBar
│   ├── workers/         # wallWorker.ts (duvar + feature)
│   └── styles/          # index.css (tailwind v4 + CSS değişkenleri)
└── tests/               # setup, fixtures, e2e/
```

**Kurallar (eslint-plugin-boundaries ile zorlu):**

- `features/*` → yalnızca `entities/*` ve `shared/*` import edebilir. Feature ↔ feature import YASAK.
- `entities/*` → yalnızca tipler; `shared/*`'a import edebilir, feature'a edemez.
- `shared/*` → hiçbir feature/app modülüne import edemez (en alt katman).
- Cross-feature runtime state `shared/model` içinde tutulur (store'lar).

## 3. Veri Katmanı

### 3.1 MarketFeed arayüzü

```ts
interface MarketFeed {
  readonly symbol: string
  readonly timeframe: string
  readonly mode: 'live'
  start(): void
  stop(): void
  setPaused(p: boolean): void
  /** Kullanıcı aksiyonu: backoff sıfırlanır, host rotasyonu yapılır, hemen bağlanılır */
  retryNow(): void
  on(handler: (e: FeedEvent) => void): () => void
}
type FeedEvent =
  | { type: 'status'; status: FeedStatus; error?: string }
  | { type: 'book'; book: BookSnapshot }
  | { type: 'candle'; candle: Candle } // açık mum canlı güncelleme veya kapanış
  | { type: 'ticker'; ticker: Ticker }
  | { type: 'history'; candles: Candle[] } // REST geçmişi (canlı mumlarla birleştirilir)
```

`createMarketFeed(opts)` fabrikası:

- Tek veri kaynağı **gerçek borsa**: WS birleşik stream + REST kline geçmişi.
- Tarayıcı ağı koptuğunda status `offline` olur; `online` olayında `retryNow()` ile anında deneme.
- Pill'e dokunmak (`retryNow`) backoff'u sıfırlar ve hemen yeniden bağlanır.
- Veri gelmediğinde hiçbir yedek/simüle kaynak devreye girmez: arayüz boş kalır ve durumu söyler.

### 3.2 Live feed

- Tek bağlantı: `depth20@100ms + kline_<tf> + ticker` (combined stream URL).
- Mesajlar zod ile doğrulanır (`depth20Schema`, `klineSchema`, `tickerSchema`);
  geçersiz → `console.warn` + atla (akış düşmez). Eski derinlik snapshot'ı (geriye düşen
  `lastUpdateId`) atılır.
- **Tel formatı sözleşmesi (borsanın gerçek yükü — `tests/integration/binanceWireContract.test.ts`):**
  · Kısmi derinlik (`<sym>@depth20@100ms`): `{ lastUpdateId, bids, asks }` — bu akışta
  **`e` (event type) alanı yoktur**; mesaj tipi `bids`+`asks` dizilerinin varlığından anlaşılır.
  (`e:"depthUpdate"` + `u`/`b`/`a` biçimi fark depth akışına aittir.)
  · Kline (`<sym>@kline_<tf>`): `{ e:"kline", k:{ t,o,h,l,c,v,x } }`.
  · Ticker (`<sym>@ticker`): `{ e:"24hrTicker", c, P, h, l, v }` — 24s yüksek/düşük **küçük
  harf** `h`/`l` alanlarındadır; yükteki büyük harf `L` "son işlem kimliği"dir (fiyat değil),
  bu yüzden fiyat olarak okunmaz.
  · REST `/api/v3/klines` satırı: `[openTime, o, h, l, c, v, closeTime, …]`.
- **Exponential backoff:** 1s → 2s → 4s → 8s → … max 30s, ±%20 jitter ile.
- **Host rotasyonu:** birincil WS/REST host'a erişilemezse gerçek yedek host'lar denenir.
- **Heartbeat:** 30 sn mesaj gelmezse soket ölü kabul edilir → yeniden bağlan.
- **Visibility API:** sekme hidden → WS kapat (pil); visible → yeniden bağlan.
- **Network API:** `offline` → status `offline`; `online` → `retryNow()`.
- Geçmiş mumlar REST `GET /api/v3/klines?limit=500` ile alınır; kapanmışlık gerçek `closeTime`
  alanından türetilir. Alınamazsa `HISTORY_RETRY_MS` aralığıyla yeniden denenir.
- **Hiçbir koşulda üretilmiş veri yayınlanmaz** (bkz. 3.3).

### 3.3 Veri dürüstlüğü (simülasyon yasağı)

- Kod tabanında simülasyon/mock feed, seed'li RNG, sentetik fiyat serisi **bulunmaz**.
- Veri gelmediğinde: mum yok, kitap yok, fiyat yok → arayüz boş durum + durum bildirimi gösterir.
- Servis çalışanı borsa yanıtlarını önbelleğe almaz (NetworkOnly), böylece eski veri
  "canlı" gibi sunulmaz.
- Ölçüm/araştırma araçları da gerçek veriyle çalışır: `npm run backtest` gerçek Binance
  kline verisi çeker (ağ yoksa `KLINES_FILE` ile gerçek veri dosyası verilir).

### 3.4 Mum penceresi ve sıralama garantisi

`shared/lib/candles.ts`:

- `upsertCandle`: aynı zaman → güncelle (kapanmış mum açılmaz), eski zaman → doğru konuma ekle,
  üst sınır (`MAX_CANDLES = 500`) aşılırsa en eskiler düşer.
- `mergeHistory`: REST geçmişi canlı mumlarla birleştirilir (geçmiş kapalı mumda kesin kaynak,
  açık mumda canlı veri taze kabul edilir).
- Store `candlesRewriteSeq` ile pencere yapısının değiştiğini bildirir; grafik tam `setData()`
  yapar. Böylece `series.update()` daima ileri giden zamanla çağrılır (bkz. ARCHITECTURE §3).

### 3.5 Orderbook normalizasyonu

`shared/lib/book.ts` — `normalizeBookRows(rows, side)`:

- string→number (decimal.js-light), NaN/≤0 satırlar atılır; sıralama (bids ↓, asks ↑);
- aynı fiyat birleştirilir (qty toplam); **kümülatif derinlik** (`total`) eklenir.

## 4. Duvar Tespiti

`shared/lib/walls.ts` — `detectWalls(book, { multiplier, window, maxWalls }): Wall[]`

- **Adaptif eşik:** coin bazlı `wallMultiplier` (BTC 2.2 … DOGE 1.4) `shared/config`'te.
- **Kümülatif pencere:** i..i+2 toplamı ≥ `median(levelQty) * window * multiplier` → duvar (komşular birleşir).
- `strength = windowQty / (median * window)` → renk/opasite + model feature'ı.
- **Ömür takibi:** `WallTracker` (worker'da) aynı fiyattaki duvarın kaç tick'tir sürdüğünü sayar; ≥5 tick → `stable`.
- **Worker:** `shared/workers/wallWorker.ts` → `{ walls, features }` döner; main thread render eder.
  Test/worker yoksa inline fallback (aynı kod yolu).

## 5. Öğrenme Modeli (Prediction)

Matematik detayı: `docs/MODEL.md`. Özet:

- **Feature'lar (hepsi [-1,1]):** `momentum`, `imbalance`, `wallPressure`, `trend`, `volatility`.
  Öteleme (scaling) `tanh(x / k)` ile; k değerleri ATR bazlı → coin'e adaptif.
- **Tahmin:** `score = Σ wᵢ·xᵢ`; `|score| > 0.15` değilse `flat`; `confidence = |score|` clamp [0,1].
- **Öğrenme:** sürekli hedef `target = sign(move) · min(1, |move| / threshold)`,
  `threshold = atrMoveFactor · ATR(14)` (coin bazlı). `w += lr·(target − score)·x − decay·w`,
  ağırlıklar [-2,2] clamp.
- **Versiyonlama:** `weights.version`; sürüm uyuşmazlığında ağırlıklar sıfırlanır, istatistikler korunur.
- **Koşu zamanı:** `features/prediction/lib/predictionEngine.ts` — kapalı mumda:
  1. bekleyen tahmin çözümlenir (hit/miss/neutral) → ağırlık güncelleme + istatistik + kova + haptic + toast;
  2. yeni tahmin üretilir. Tüm state IndexedDB'ye persist (sayfa yenilense de bekleyen tahmin korunur).

## 6. Kalıcılık (IndexedDB)

- `idb-keyval` anahtarları: `lanka:learning:{symbol}`, `lanka:preferences`.
- `learning/{symbol}` → `{ weights, stats, recent[≤30], buckets{low,medium,high}, pending }`.
- **Migrasyon:** v1 localStorage şekli (`{weights, stats{total,correct,streak}, recent}`) → v2 (saf fonksiyon + test).
- **Export/Import:** JSON indirme / dosya yükleme (zod doğrulamalı).
- **Otomatik temizlik:** 90 günden eski `recent` kayıtları load/save'de elenir.

## 7. UI/UX (mobil öncelikli — LANKA v2 Redesign)

- **Sticky Header (≤56px):** Coin seçici (arama + favoriler) + canlı fiyat + 24s yüzde değişim tek satırda; aşağı kaydırmada otomatik gizlenme (`-translate-y-full`), yukarı kaydırmada geri gelme.
- **İstatistik Şeridi (MetricsRow):** 4 kartlık dikey blok yerine tek satırlık yatay kaydırılabilir özet şerit (24s Y/D, Hacim, Spread, Derinlik).
- **Zaman Dilimi Seçicisi:** Header altından çıkarılıp doğrudan mum grafiğinin üst araç çubuğuna taşındı.
- **Grafik Çizim Alanı:** Dinamik yükseklik (`flex-1`, ekranın ≥%45'i, min-h 260px); lightweight-charts; duvarlar `createPriceLine` (en güçlü ilk 3 duvar etiketli, diğerleri ince çizgi); çift dokunuş → fit; tam ekran butonu (landscape & Fullscreen API).
- **En Yakın Duvar Çipi:** Grafik araç çubuğunda güncel fiyata en yakın duvar seviyesi ve mesafesini gösterir; dokunulduğunda Duvarlar paneline yönlendirir.
- **Kompakt Model Tahmin Şeridi & Bottom Sheet:** Sabit 182px blok yerine tek satırlık (44px) özet buton; dokunulduğunda tam `Vaul` tabanlı Model Tahmin & Sinyal Analizi Bottom Sheet açılır.
- **Bilgi Mimarisi (3 Tab):** `Grafik`, `Duvarlar`, `Model` (Model sekmesi içinde alt sekmeler: `Kovalar`, `Hafıza`, `Ayarlar`).
- **Panel Yaşam Döngüsü:** Yalnızca aktif olan sekme DOM'a mount edilir (bellek ve CPU optimizasyonu).
- **Sinyal Gücü Terminolojisi:** "Güven" yerine yanıltıcı olmayan "Sinyal Gücü %X" ve modelin gerçek geçmiş isabet oranı (≥20 örnekte) gösterilir.
- **Türkçe Yalın Duvar Etiketleri:** "Alış Duvarı (Destek)", "Satış Duvarı (Direnç)"; kafa karıştırıcı jargon temizlendi.
- **Duvar Alarmları:** Fiyat duvara %0.2 yaklaştığında veya duvar kırıldığında ses/titreşim, Sonner toast ve Web Notification API bildirimi.
- **Orderbook Etkileşimi:** Duvarlar tablosunda satıra dokunarak duvara alarm kurma veya grafikte vurgulama.
- **Ayarlar:** Açık/Koyu tema (Light/Dark mode), Renk Körü Modu (Mavi/Turuncu), Dokunsal Geri Bildirim (Haptics) ve Fiyat Alarmları açma/kapama kontrolleri.
- **Onboarding (Rehber):** İlk açılışta veya yardım butonunda 3 adımlı interaktif mini rehber ("Duvar Nedir?", "Sinyal Gücü Ne Demek?", "Nasıl Okunur?").
- **Minimum Dokunmatik Alan:** Tüm butonlar ve etkileşimli alanlar mobil standartlarına uygun ≥44×44px (kompakt araç çubuklarında min 32px + 44px hitbox).
- **Safe Area & Landscape:** `env(safe-area-inset-*)` uyumu, yatay modda (landscape) 36px header ve 37px nav ile maksimum grafik alanı.

## 8. Performans

- Duvar + feature hesabı **worker'da**; main thread sadece render.
- Kitap olayları store'a **100 ms throttle** ile işlenir.
- `Intl.NumberFormat` **modül seviyesinde cache**.
- `React.memo` (orderbook satırı), `useMemo`/`useCallback` kritik yollarda.
- Grafik `React.lazy` ile yavaş yüklenir (ilk açılışta panel skeleton ile).
- PWA: statikler cache-first (precache), borsa REST yanıtları **NetworkOnly** (eski veri gösterilmez), WS network-only.
- Bundle analizi: `npm run bundle:analyze` (rollup-plugin-visualizer).

## 9. Test

| Katman      | Araç                                       | Kapsam                                                                                                                                            |
| ----------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                                     | `detectWalls`, `normalizeBookRows`, `upsertCandle`/`mergeHistory`, `planChartSync`, `PredictionModel`, `format*`, buckets, migrasyon, marketStore |
| Integration | Vitest + jsdom                             | canlı feed (Binance tel formatı) → store → panel render; backoff/host rotasyonu; veri yokken hiçbir veri üretilmediğinin doğrulanması             |
| Gerçek ağ   | Vitest (opt-in)                            | `LANKA_LIVE_NETWORK=1` → canlı Binance REST'ten gerçek mumlar                                                                                     |
| E2E         | Playwright (iPhone 13 / Pixel 5 / Desktop) | açılış, gerçek fiyat/grafik, çevrimdışı dürüst durum, coin değişimi, tab navigasyonu, pull-to-refresh                                             |
| Coverage    | v8                                         | hedef %70+ (`npm run test:coverage`)                                                                                                              |

## 10. DevOps & Yayın

- **CI (GitHub Actions):** `ci/ci.yml` → quality (lint → format → test:coverage → build) + e2e
  (Playwright/Chromium; borsa erişimini yoklar). `ci/market-watch.yml` → günlük gerçek-veri
  doğrulaması (canlı sözleşme testi + çok sembollü backtest → JSON artifact + iş özeti).
  `.github/workflows` altına alınması için `ci/enable-actions.sh` (bkz. `ci/README.md`).
- **Codespaces/Dev Container:** `.devcontainer/devcontainer.json` — Node 22, port yönlendirme
  (5173/4173), `npm ci`; elle QA/Lighthouse/E2E için tek tıkla ortam.
- **Deploy:** statik build (server gerekmez; WS tarayıcıdan bağlanır).
  · **GitHub Pages:** `bash scripts/deploy-pages.sh` (gh-pages dalı) veya `ci/deploy-pages.yml`
  (Actions). Proje siteleri `/<repo>/` altından servis edildiği için build
  `VITE_BASE_PATH=/<repo>/` ile alınır; PWA `start_url`/`scope` ve SW `navigateFallback`
  aynı tabana göre üretilir.
  · **Vercel/Netlify:** kök alan adı → `VITE_BASE_PATH` verilmez (varsayılan `/`).
- **Env:** `VITE_BINANCE_WS`, `VITE_BINANCE_WS_FALLBACKS`, `VITE_BINANCE_REST`,
  `VITE_BINANCE_REST_FALLBACKS` (örnek: `.env.example`).
- **PWA:** manifest (192/512 + maskable), `display: standalone`, tema rengi; çevrimdışıyken
  uygulama kabuğu açılır, bağlantı durumu açıkça bildirilir.
- **Opsiyonel (bu kapsamda değil):** Sentry, analytics, Storybook, Capacitor paketleme.

## 11. Kabul Kriterleri (Definition of Done)

- [x] Mobil viewport'ta akıcı render (worker + throttle + memo).
- [x] İlk yükleme < 2 s (statik + precache); 3G senaryosu CI'da ölçülür (Lighthouse — izleme).
- [x] WS kopunca < 30 sn içinde reconnect (backoff + host rotasyonu + watchdog testleri var).
- [x] Öğrenme verisi IndexedDB'de kalıcı; sayfa yenilenince korunur (test).
- [x] Tüm unit testler geçiyor, coverage > %70.
- [x] E2E 3 viewport'ta (CI'da).
- [x] Coin değişiminde yeni veri anında (store reset + yeni feed; test).
- [x] Duvar tespiti worker'da (inline fallback test edilebilir).
- [x] PWA yüklenebilir; çevrimdışıyken dürüst bağlantı durumu gösterir (E2E + SW).
- [x] Grafik motoru hatası imkânsız: `planChartSync` geriye giden zamanı asla `update()` ile
      göndermez (bkz. ARCHITECTURE §3) — regresyon testleri var.
- [x] Kod tabanında simülasyon/mock/yer tutucu veri yok; bağlantı yoksa veri uydurulmaz.

## 12. Kapsam Notu (Bu Çalışma Oturumu)

Bu oturumda Faz 1–6 + Faz 7'nin çekirdeği (CI) tamamlandı: iskelet, veri, grafik, model, UI/UX,
testler, PWA, CI ve dokümantasyon. Aşağıdaki maddeler bilinçli olarak **ertelendi** (TASKS.md'de işaretli):
Storybook, Sentry/analytics, Capacitor, Light mode (token'lar hazır, toggle yok), Lighthouse CI,
visual regression (Chromatic).
