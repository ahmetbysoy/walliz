# LANKA v2 — Görev Panosu

Durum: ✅ tamamlandı · 🚧 devam ediyor · ⬜ bekliyor · ⏸ ertelendi (bilinçli)

## Faz 0 — Planlama

- [x] T001 Spesifikasyon kararı + `docs/SPEC.md`
- [x] T002 Mimari + veri akış diyagramı (`docs/ARCHITECTURE.md`)
- [x] T003 Görev panosu (`docs/TASKS.md`)

## Faz 1 — İskelet

- [x] T101 Vite + React 18 + TS (strict) + Tailwind v4 + ESLint (flat, boundaries) + Prettier
- [x] T102 Feature-sliced klasör yapısı + boundaries kuralları
- [x] T103 CSS değişkenleri → `@theme inline` map (`--mint/--coral/--violet/--bg`)
- [x] T104 shared/ui temel bileşenleri (Button, Card, MetricCard, Skeleton, EmptyState, Sheet, Select, Tabs, ConfidenceBar)
- [x] T105 App shell: sticky header + alt navigasyon (4 tab) + safe area
- [x] T106 Env değişkenleri (`.env.example`) + CI workflow (lint/test/build/e2e)

## Faz 2 — Veri

- [x] T201 MarketFeed arayüzü + `createMarketFeed` fabrikası (yalnız gerçek canlı veri; demo modu kaldırıldı — bkz. Faz 8)
- [x] T202 ~~Demo feed~~ → **kaldırıldı** (simülasyon yasağı); yerine gerçek REST kline geçmişi + sıralama/birleştirme kuralları
- [x] T203 Live feed: combined WS (depth20@100ms + kline + ticker) + zod şemaları + WS/REST host rotasyonu
- [x] T204 Reconnect: exponential backoff (1→30s) + heartbeat 30s + visibility + network API
- [x] T205 Bağlantı durumu yönetimi (connecting/live/reconnecting/offline) + StatusPill (tıkla → retryNow)
- [x] T206 Orderbook normalizasyonu (decimal.js-light, kümülatif derinlik) + test
- [x] T207 marketStore (zustand) — feed event'leri → state + test
- [x] T208 IndexedDB kalıcılık (idb-keyval) + v1→v2 migrasyon + 90 gün temizliği + test
- [x] T209 Preferences (coin/timeframe/renk körü modu) persist

## Faz 3 — Grafik

- [x] T301 lightweight-charts v4 sarmalayıcı (candle + `series.update` gerçek zamanlı)
- [x] T302 Duvar fiyat çizgileri (createPriceLine, güç → opaklık, etiket)
- [x] T303 Volume histogram (alt overlay) + crosshair + OHLC legend
- [x] T304 Responsive (ResizeObserver) + çift dokunuş fit + dokunmatik zoom/pan
- [x] T305 Chart lazy-load + skeleton

## Faz 4 — Model

- [x] T401 Feature hesabı (tanh ölçekleme, ATR bazlı eşikler) + test
- [x] T402 PredictionModel (saf TS) — predict/learn/migrate/reset + test
- [x] T403 Duvar tespiti (adaptif eşik, kümülatif pencere, WallTracker ömür) + test
- [x] T404 Web Worker (duvar + feature) + inline fallback + test
- [x] T405 Backtest script (`npm run backtest`, **gerçek** Binance kline verisi; `KLINES_FILE` ile dosyadan)
- [x] T406 `docs/MODEL.md` — model matematiği

## Faz 5 — UI/UX

- [x] T501 Grafik paneli: metrik kartları + chart + PredictionCard (SignalOrb + ConfidenceBar)
- [x] T502 Duvarlar paneli: orderbook (memo satırlar, derinlik bar) + duvar listesi + long-press detay sheet
- [x] T503 Kovalar paneli: pyramid bucket'ları (expand/collapse) + hit rate
- [x] T504 Hafıza paneli: ağırlık barları, istatistikler, son doğrulamalar, export/import/reset
- [x] T505 Gestürler: yatay swipe tab geçişi, pull-to-refresh (feed restart), haptic
- [x] T506 Erişilebilirlik: aria-label, klavye, reduced-motion, grafik aria
- [ ] T507 Light mode toggle (token'lar hazır) — ⏸
- [ ] T508 Renk körü modu UI toggle (token'lar hazır) — ⏸

## Faz 6 — Kalite

- [x] T601 Unit testler (detectWalls, model, normalize, format, rng, buckets, migrasyon, store)
- [x] T602 Integration testler (canlı feed tel formatı→store→UI, backoff/host rotasyonu, veri yokken üretim yok kontrolü)
- [x] T603 E2E Playwright (iPhone 13 / Pixel 5 / Desktop) — sandbox'ta browser yok, CI'da çalışır
- [x] T604 PWA: manifest + ikonlar (192/512/maskable) + SW (kabuk önbellekte, borsa yanıtları NetworkOnly)
- [x] T605 Performans: throttle, format cache, memo, lazy chart
- [ ] T606 Lighthouse CI (Performance > 90, A11y > 95) — ⏸ (deploy sonrası)

## Faz 8 — Gerçek veri & dayanıklılık (bu oturum)

- [x] T801 `Cannot update oldest data, last time=[object Object], new time=[object Object]` çökmesinin kök nedeni
      (series.update'e geriye giden zaman) ve kalıcı çözümü: `chart/lib/chartSync.ts` senkron planı
- [x] T802 Mum penceresi sıralama garantisi (`shared/lib/candles.ts`): artan + tekil liste, geçmiş↔canlı birleştirme
- [x] T803 Simülasyon/mock katmanının tamamen kaldırılması (demoFeed, demoRng, DEMO_* env/sabitler, 'demo' durumu)
- [x] T804 Bağlantı dayanıklılığı: WS/REST host rotasyonu, ±%20 jitter'lı backoff, watchdog, sonsuz yeniden deneme
- [x] T805 Ağ durumu entegrasyonu (online/offline olayları, `retryNow`) + `ConnectionNotice` uyarısı
- [x] T806 Grafik boş durumu: veri yokken uydurma mum yerine durum mesajı + "Yeniden bağlan"
- [x] T807 SW: borsa yanıtları NetworkOnly (eski fiyatı canlı gibi göstermeme)
- [x] T808 Backtest'in gerçek Binance kline verisiyle çalışması (kitap feature'ları ablasyonla kapatılır)
- [x] T809 Regresyon testleri: `planChartSync`, `upsertCandle`/`mergeHistory`, feed dayanıklılığı, veri uydurulmadığı kontrolü
- [x] T810 Opt-in gerçek ağ testi (`LANKA_LIVE_NETWORK=1`)
- [x] T811 Dokümantasyonun gerçek veri mimarisine güncellenmesi (SPEC/ARCHITECTURE/README/TASKS)

## Faz 9 — CI / Actions / Codespaces (bu oturum)

- [x] T901 İş yükü GitHub Actions'a taşındı: `ci/ci.yml` (quality + E2E, concurrency iptali, artifact'ler)
- [x] T902 `ci/market-watch.yml`: günlük gerçek-veri nöbeti (tel formatı sözleşme testi + çok sembollü backtest + JSON rapor + iş özeti)
- [x] T903 E2E dayanıklılığı: borsa erişimini önce yokla; erişim yoksa akış testleri atlanır, dürüst çevrimdışı testleri koşar (yanlış kırmızı yok)
- [x] T904 `scripts/backtest.ts`: `SYMBOLS` (çok sembol) ve `REPORT_JSON` (CI artifact'i) desteği
- [x] T905 `ci/enable-actions.sh` + `ci/README.md`: `workflows` izni engelinin 3 çözüm yolu
- [x] T906 Codespaces: `.devcontainer/devcontainer.json` (Node 22, GH CLI, port yönlendirme, eklentiler) + README rozeti
- [x] T907 Editör ayarları: `.vscode/settings.json`, `.vscode/extensions.json`
- [x] T908 `npm run test:live` (canlı borsa sözleşme testi) + backtest çekirdeği için birim testleri

## Faz 9b — GitHub Pages yayını (bu oturum)

- [x] T910 Taban yol desteği: `vite.config.ts` `VITE_BASE_PATH` → `base`, PWA `start_url`/`scope`,
      SW `navigateFallback`, `index.html` `%BASE_URL%` referansları
- [x] T911 `scripts/deploy-pages.sh`: dist'i `gh-pages` dalına tek commit olarak force-push (izin gerektirmez)
- [x] T912 `ci/deploy-pages.yml`: Actions ile otomatik Pages yayını (kalite kapıları + artifact + deploy)
- [x] T913 Alt-dizin doğrulaması: `/walliz/` altında tüm varlıkların (js/css/sw/manifest/ikon) 200 döndüğü yerelde kanıtlandı
- [ ] T914 Pages'in açılması: Settings → Pages → Source (repo sahibi; API izni App'te yok — 403)

## Faz 7 — Yayın

- [x] T701 CI (GitHub Actions): lint + test + build + e2e
- [x] T702 README (kurulum, komutlar, env, mimari özeti)
- [ ] T703 Deploy (Vercel/Netlify) — ⏸ (repo sahibinin hesabı gerekli)
- [ ] T704 Sentry / analytics — ⏸
- [ ] T705 Storybook — ⏸ (opsiyonel, brief'te önerili)
- [ ] T706 Capacitor native paketleme — ⏸
