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
- [x] T507 Light mode toggle (token'lar hazır, Ayarlar paneline entegre edildi)
- [x] T508 Renk körü modu UI toggle (Ayarlar paneline entegre edildi)

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

## Faz 10 — Mobil UX ve Ekran Bütçesi Yeniden Tasarımı (LANKA v2 Redesign)

- [x] **Adım 0 (Baseline):** 390×844, 360×640 ve 844×390 viewports için başlangıç geometrileri Playwright ile ölçüldü ve `docs/UX_BASELINE.md` dosyasına kaydedildi.
- [x] **T-P0-1:** Tek satırlık Header (≤56px) — Coin seçici + canlı fiyat + 24s yüzde değişim tek satıra toplandı.
- [x] **T-P0-2:** Zaman dilimi (Timeframe) seçici header altından mum grafiğinin araç çubuğuna taşındı.
- [x] **T-P0-3:** 4 kartlık dikey MetricsRow (194px) kaldırılarak yerine tek satırlık yatay kaydırılabilir (24px) istatistik şeridi yerleştirildi.
- [x] **T-P0-4:** Grafik alanı dinamik yüksekliğe (`flex-1`, viewport ≥%45, min-h 260px) kavuşturuldu; küçük cihazlarda nav ile çakışma giderildi.
- [x] **T-P0-5:** PredictionCard sabit 182px blok yerine tek satırlık interaktif buton yapıldı; tıklandığında Vaul Bottom Sheet açılıyor.
- [x] **T-P0-6:** Header dikey kaydırmada otomatik gizlenme/görünme davranışına kavuşturuldu (scroll direction threshold).
- [x] **T-P1-1:** 4 tab 3 tab'a indirildi: `Grafik`, `Duvarlar`, `Model` (Model içinde Kovalar, Hafıza ve Ayarlar alt sekmeleri).
- [x] **T-P1-2:** Yalnızca aktif olan sekme DOM'a mount ediliyor (arka plandaki grafik/tablo CPU yükü sıfırlandı).
- [x] **T-P1-3:** İlk açılışta ve yardım butonunda 3 kartlık interaktif mini rehber (Onboarding) eklendi.
- [x] **T-P1-4:** Duvar etiketleri sade Türkçe yapıldı ("Alış Duvarı", "Satış Duvarı") ve grafik üstündeki fiyat çizgileri en güçlü 3 duvarla sınırlandı.
- [x] **T-P1-5:** Grafiğin araç çubuğuna en yakın duvar seviyesini ve mesafesini gösteren interaktif çip eklendi; tıklandığında Duvarlar sekmesine yönlendiriyor.
- [x] **T-P1-6:** Model güveni "Sinyal Gücü %X" olarak adlandırıldı; <20 doğrulamada "(yeterli veri yok)", ≥20 doğrulamada gerçek geçmiş isabet oranı eklendi.
- [x] **T-P1-7:** Tüm dokunmatik etkileşim alanları minimum 44×44px kuralına uyarlandı.
- [x] **T-P2-1:** Fiyat duvara yaklaştığında (%0.2) ve duvar kırıldığında ses/titreşim, toast ve Notification bildirimleri (Wall Alerts).
- [x] **T-P2-2:** Coin seçiciye anlık arama ve favori yıldızlama desteği eklendi.
- [x] **T-P2-3:** Grafik araç çubuğuna tam ekran (fullscreen) / yatay mod butonu eklendi.
- [x] **T-P2-4:** Ayarlar alt sekmesine Light Mode, Renk Körü Modu, Titreşim (Haptics) ve Fiyat Alarmları açma/kapama toggles eklendi.
- [x] **T-P2-5:** Duvarlar tablosunda satıra dokunulduğunda alarm kurma / grafikte vurgulama özelliği eklendi.
- [x] **T-P2-6:** Veri yüklenirken ve feed açılırken Skeleton yer tutucuları eklendi.
- [x] **T-P3-1:** Tek jest bağlamı (single gesture context) ile grafik pan/zoom ve yatay kaydırmalar swipe çakışmasından izole edildi.
- [x] **T-P3-2:** Dokümantasyon (`SPEC.md`, `TASKS.md`, `UX_BASELINE.md`, `BACKLOG.md`) güncellendi.
- [x] **T-P3-3:** `tests/e2e/layout.spec.ts` ile tüm ekran geometrileri ve kabul kriterleri CI'da otomatik doğrulanabilir kılındı.

- [x] T913 Alt-dizin doğrulaması: `/walliz/` altında tüm varlıkların (js/css/sw/manifest/ikon) 200 döndüğü yerelde kanıtlandı
- [ ] T914 Pages'in açılması: Settings → Pages → Source (repo sahibi; API izni App'te yok — 403)

## Faz 10 — Gerçek tel formatı denetimi (bu oturum)

Kullanıcı bildirimi: "readme'deki özelliklerin çoğu çalışmıyor". Kök neden, feed'in kendi
test double'larıyla doğrulanan **yanlış tel formatı varsayımlarıydı** (testler kendi
varsayımını doğruladığı için yeşil kalıyordu). Resmî dokümanla karşılaştırıldı
(`binance/binance-spot-api-docs`):

- [x] T1001 **Kısmi derinlik yükü**: `{ lastUpdateId, bids, asks }` — şema `e: 'depth20'`
      istiyordu, gerçek yükte `e` YOK → sipariş kitabı hiç dolmuyordu. Mesaj tipi artık
      yükün şeklinden tanınır (`isDepthSnapshot`); güncelleme kimliği `lastUpdateId`.
      Etkisi: orderbook paneli, spread, duvar tespiti, `imbalance`/`wallPressure`
      ve (kitap şartı nedeniyle) tahmin/kovalar/hafıza tamamen ölüydü.
- [x] T1002 **Ticker yükü**: 24s yüksek/düşük küçük harf `h`/`l`; şema `H`/`L` istiyordu
      (büyük `L` gerçekte "son işlem kimliği") → her ticker mesajı düşüyordu; fiyat/24s
      değişim/hacim hiç gelmiyordu.
- [x] T1003 Sözleşme testi: `tests/integration/binanceWireContract.test.ts` — resmî
      dokümandan birebir yüklerle üç akış (derinlik/kline/ticker) + büyük harf `L` tuzağı.
- [x] T1004 Orderbook derinlik çubukları: ölçek en iyi seviyenin kümülatifi yerine
      taraftaki **en derin** kümülatif toplamdan alınıyor (çubuklar tavana yapışmıyordu).
- [x] T1005 Spread yüzdesi oran yerine yüzde olarak biçimleniyor (`+0.01%`), `—` durumu
      renkli "düşüş" olarak gösterilmiyor.
- [x] T1006 Radix `Select`: ipucu `ItemText` dışına alındı (tetikleyicide "BTC Bitcoin"
      taşması), `ConfidenceBar` aria etiketi gerçek yüzdeyi taşıyor.

## Faz 7 — Yayın

- [x] T701 CI (GitHub Actions): lint + test + build + e2e
- [x] T702 README (kurulum, komutlar, env, mimari özeti)
- [ ] T703 Deploy (Vercel/Netlify) — ⏸ (repo sahibinin hesabı gerekli)
- [ ] T704 Sentry / analytics — ⏸
- [ ] T705 Storybook — ⏸ (opsiyonel, brief'te önerili)
- [ ] T706 Capacitor native paketleme — ⏸
