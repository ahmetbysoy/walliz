# LANKA v2 — Teknik Spesifikasyon (Kararlı Versiyon)

> Orderbook duvarlarını gerçek zamanlı izleyen, coin bazlı öğrenen, **mobil öncelikli** piyasa ekranı.
> Bu doküman, orijinal brief'in kararlar alınmış hâlidir. Görev takibi için `docs/TASKS.md`,
> mimari için `docs/ARCHITECTURE.md`, model matematiği için `docs/MODEL.md`.

## 0. Vizyon

- Duvar (wall) tespiti: orderbook'te olağandışı hacim kümelenmelerini gerçek zamanlı bulur.
- Öğrenme: her mum kapanışında yön tahmini yapar, sonuçla karşılaştırır, ağırlıklarını günceller (coin başına).
- Kovalar (pyramid): tahmin doğruluğunu güven aralığına göre bucket'lar; "modelin kendine güveni ne kadar güvenilir?" sorusuna cevap verir.
- Demo modu: canlı veri yoksa (offline, hata, sandbox) deterministik seed'li feed'e düşer; UI'da açıkça gösterilir.

**Hedef kitle:** mobilde hızlı bakan trader'lar. Masaüstü ikincil.

## 1. Stack Kararları

| Alan         | Karar                                                                                        | Neden                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Çekirdek     | **Vite 5 + React 18 + TypeScript (strict)**                                                  | SSR gereksiz; PWA statik çalışır. Next ek ağırlık.                                         |
| State        | **Zustand v5**                                                                               | Hafif, selector'lı, test edilebilir. Redux Toolkit: KULLANILMIYOR.                         |
| Server state | **TanStack Query v5**                                                                        | Sadece REST kline geçmişinde; canlı veri ham WS üzerinden.                                 |
| Router       | **Yok** (tek sayfa + tab)                                                                    | Gereksiz bağımlılık.                                                                       |
| Stil         | **Tailwind CSS v4** + tailwind-merge + clsx                                                  | CSS değişkenleri (`--mint`, `--coral`, `--violet`, `--bg`) `@theme inline` ile map edilir. |
| UI kiti      | **Radix** (Select, Dialog, Tabs, Collapsible) + **vaul** (bottom sheet) + **Sonner** (toast) | shadcn kalıbı, ama CLI yerine elle küçük sarmalayıcılar (registry erişimi yok).            |
| Animasyon    | **Framer Motion**                                                                            | Sheet/toast/sinyal animasyonları; `useReducedMotion` desteği.                              |
| İkon         | **lucide-react**                                                                             | Emoji ikonlar kaldırıldı.                                                                  |
| Grafik       | **lightweight-charts v4**                                                                    | Mum grafiği + dokunmatik zoom/pan native. Recharts/Chart.js: KULLANILMIYOR.                |
| Validasyon   | **zod v3**                                                                                   | WS mesaj şemaları; geçersiz mesaj → log, stream düşmez.                                    |
| Sayı         | **decimal.js-light**                                                                         | Orderbook satır parse/toplamlarında float hatası riski.                                    |
| Kalıcılık    | **idb-keyval (IndexedDB)**                                                                   | localStorage yerine; v1→v2 migrasyonu var.                                                 |
| Gestür       | **@use-gesture/react**                                                                       | Swipe, pull-to-refresh, long-press (elde hook).                                            |
| PWA          | **vite-plugin-pwa** (workbox)                                                                | Manifest + SW + offline fallback → demo mod.                                               |
| Test         | **Vitest + Testing Library** (unit/integration), **Playwright** (E2E)                        | Coverage hedefi %70+.                                                                      |
| Lint         | **ESLint 9 (flat) + Prettier + eslint-plugin-boundaries**                                    | Feature sınırları zorlanıyor.                                                              |
| Zaman        | **Intl (cache'li)**                                                                          | date-fns gerek kalmadı; `Intl.NumberFormat` modül seviyesinde cache.                       |
| Worker       | **Web Worker (Vite module worker)**                                                          | Duvar tespiti + feature hesabı; inline fallback (test/SSR).                                |

**Kaçınılanlar:** Redux Toolkit, Recharts/Chart.js, MUI/AntD, Socket.io, Moment.js,
ham localStorage, render başına Intl.NumberFormat, main thread'de ağır hesap, sabit reconnect.

## 2. Klasör Yapısı (Feature-Sliced)

```
src/
├── app/                 # entry, providers, shell, feed/engine orkestrasyon hook'ları
├── entities/            # paylaşılan tipler (market, orderbook, prediction) — fonksiyon YOK
├── features/
│   ├── market-feed/     # live WS feed + demo feed + StatusPill
│   ├── orderbook/       # kitap + duvar UI (saf algoritmalar shared/lib'de)
│   ├── chart/           # lightweight-charts sarmalayıcı
│   ├── pyramid/         # kovalar (bucket) UI
│   ├── prediction/      # tahmin motoru orkestrasyonu + sinyal UI
│   ├── learning-memory/ # kalıcılık UI + export/import
│   └── preferences/     # coin / timeframe seçicileri
├── shared/
│   ├── config/          # COINS, TIMEFRAMES, env (ws/rest base), duvar sabitleri
│   ├── lib/             # format, math, book, walls, features, model, buckets, repo, wallEngine
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
  readonly mode: 'live' | 'demo'
  start(): void
  stop(): void
  setPaused(p: boolean): void
  forceLive(): void
  on(handler: (e: FeedEvent) => void): () => void
}
type FeedEvent =
  | { type: 'status'; status: FeedStatus; error?: string }
  | { type: 'book'; book: BookSnapshot }
  | { type: 'candle'; candle: Candle } // açık mum canlı güncelleme veya kapanış
  | { type: 'ticker'; ticker: Ticker }
  | { type: 'history'; candles: Candle[] } // başlangıç seed'i
```

`createMarketFeed(opts)` fabrikası:

- `mode: 'demo'` veya `VITE_DEMO_MODE=1` veya `!navigator.onLine` → **demo feed**.
- `mode: 'auto'` → live dene; **3 deneme / 30 sn** içinde kurulamazsa demo'ya düş (status pill DEMO).
- Pill'e dokununca `forceLive()` ile tekrar canlı denemesi.

### 3.2 Live feed

- Tek bağlantı: `depth20@100ms + kline_<tf> + ticker` (combined stream URL).
- Mesajlar zod ile doğrulanır (`zDepth20`, `zKline`, `zTicker`); geçersiz → `console.debug` + atla.
- **Exponential backoff:** 1s → 2s → 4s → 8s → … max 30s.
- **Heartbeat:** 30 sn mesaj gelmezse `ws.close()` → yeniden bağlan.
- **Visibility API:** sekme hidden → WS kapat (pil); visible → hızlı reconnect.
- **Network API:** `offline` → anında demo; `online` → canlı denemesi.
- Geçmiş mumlar REST `GET /api/v3/klines?limit=300` ile seed edilir (başarısızsa sessizce).

### 3.3 Demo feed

- Ayrı modül, aynı `MarketFeed` arayüzü. **Seed'li RNG (mulberry32)** → deterministik.
- Seed = `hash(symbol + timeframe + VITE_DEMO_SEED?)`.
- 180 geçmiş mum + canlı random-walk; kitaba periyodik duvar yerleştirir (20–60 tick ömür).
- Demo mumlar hızlandırılmış (8 sn/kapanış) — E2E'de tahmin döngüsü gözlemlenebilir.
- Testlerde `timed: false` + manuel `tick()` ile tamamen deterministik akış.

### 3.4 Orderbook normalizasyonu

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

## 7. UI/UX (mobil öncelikli)

- **Sticky header:** status pill + coin seçici (Radix Select) + timeframe chips (1m/5m/15m/1h) + büyük fiyat.
- **Alt navigasyon:** 4 tab (Grafik, Duvarlar, Kovalar, Hafıza); yatay swipe ile tab geçişi;
  satır detayı long-press → vaul bottom sheet.
- **Pull-to-refresh:** feed yeniden başlar (spinner geri bildirimli).
- **Grafik:** lightweight-charts; duvarlar `createPriceLine` (yanılgı değil: fiyat çizgisi + etiket),
  duvar gücüne göre opaklık; volume histogram alt overlay; `series.update` ile gerçek zamanlı;
  `ResizeObserver`; çift dokunuş → fit; `role="img"` + dinamik aria-label.
- **Bileşenler:** `MetricCard` (variant: default/price/up/down), `OrderbookRow` (React.memo),
  `WallBadge`, `SignalOrb` (pulse), `ConfidenceBar` (spring), `PyramidBucket` (expand/collapse),
  `LearningPanel` (ağırlık barları + son doğrulamalar), `EmptyState`, `Skeleton`.
- **Haptic:** tahmin çözülünce `navigator.vibrate(50)`, duvar görünce 20 ms, tab geçişinde 10 ms (destekleyen cihazlarda).
- **Tema:** dark default; `prefers-color-scheme` uyumlu token'lar; **renk körü modu** (`--mint/--coral` → mavi/turuncu).
- **Erişilebilirlik:** aria-label her yerde, klavye navigasyonu, `prefers-reduced-motion` → animasyon kapatılır.
- **Safe area:** `env(safe-area-inset-*)` padding'ler.

## 8. Performans

- Duvar + feature hesabı **worker'da**; main thread sadece render.
- Kitap olayları store'a **100 ms throttle** ile işlenir.
- `Intl.NumberFormat` **modül seviyesinde cache**.
- `React.memo` (orderbook satırı), `useMemo`/`useCallback` kritik yollarda.
- Grafik `React.lazy` ile yavaş yüklenir (ilk açılışta panel skeleton ile).
- PWA: statikler cache-first (precache), REST NetworkFirst (1 sn), WS network-only.
- Bundle analizi: `npm run bundle:analyze` (rollup-plugin-visualizer).

## 9. Test

| Katman      | Araç                                       | Kapsam                                                                                                                   |
| ----------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Unit        | Vitest                                     | `detectWalls`, `normalizeBookRows`, `PredictionModel`, `format*`, demo RNG determinizmi, buckets, migrasyon, marketStore |
| Integration | Vitest + jsdom                             | demo feed → store → panel render; mock WebSocket → mesaj → state; backoff → demo fallback                                |
| E2E         | Playwright (iPhone 13 / Pixel 5 / Desktop) | açılış, coin değişimi, tab navigasyonu, offline → demo                                                                   |
| Coverage    | v8                                         | hedef %70+ (`npm run test:coverage`)                                                                                     |

## 10. DevOps & Yayın

- **CI (GitHub Actions):** lint → test(coverage) → format check → build; ayrı job'da Playwright (chromium).
- **Deploy:** statik build → Vercel/Netlify (server gerekmez; WS tarayıcıdan bağlanır).
- **Env:** `VITE_DEMO_MODE`, `VITE_BINANCE_WS`, `VITE_BINANCE_REST`, `VITE_DEMO_SEED` (örnek: `.env.example`).
- **PWA:** manifest (192/512 + maskable), `display: standalone`, tema rengi; offline → demo mod.
- **Opsiyonel (bu kapsamda değil):** Sentry, analytics, Storybook, Capacitor paketleme.

## 11. Kabul Kriterleri (Definition of Done)

- [x] Mobil viewport'ta akıcı render (worker + throttle + memo).
- [x] İlk yükleme < 2 s (statik + precache); 3G senaryosu CI'da ölçülür (Lighthouse — izleme).
- [x] WS kopunca < 30 sn içinde reconnect veya demo'ya düş (backoff + fallback testi var).
- [x] Öğrenme verisi IndexedDB'de kalıcı; sayfa yenilenince korunur (test).
- [x] Tüm unit testler geçiyor, coverage > %70.
- [x] E2E 3 viewport'ta (CI'da).
- [x] Coin değişiminde yeni veri anında (store reset + yeni feed; test).
- [x] Duvar tespiti worker'da (inline fallback test edilebilir).
- [x] PWA yüklenebilir; offline'da demo modda çalışır (E2E + SW).

## 12. Kapsam Notu (Bu Çalışma Oturumu)

Bu oturumda Faz 1–6 + Faz 7'nin çekirdeği (CI) tamamlandı: iskelet, veri, grafik, model, UI/UX,
testler, PWA, CI ve dokümantasyon. Aşağıdaki maddeler bilinçli olarak **ertelendi** (TASKS.md'de işaretli):
Storybook, Sentry/analytics, Capacitor, Light mode (token'lar hazır, toggle yok), Lighthouse CI,
visual regression (Chromatic).
