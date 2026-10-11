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
- [x] T201 MarketFeed arayüzü + `createMarketFeed` fabrikası (auto/live/demo)
- [x] T202 Demo feed: seed'li RNG (mulberry32), deterministik, 180 mum geçmiş, periyodik duvarlar
- [x] T203 Live feed: combined WS (depth20@100ms + kline + ticker) + zod şemaları
- [x] T204 Reconnect: exponential backoff (1→30s) + heartbeat 30s + visibility + network API
- [x] T205 Demo ↔ Live otomatik geçiş + StatusPill (tıkla → forceLive)
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
- [x] T405 Backtest script (`npm run backtest`, sentetik seri)
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
- [x] T602 Integration testler (demo feed→store→UI, mock WS→state, backoff→fallback)
- [x] T603 E2E Playwright (iPhone 13 / Pixel 5 / Desktop) —  sandbox'ta browser yok, CI'da çalışır
- [x] T604 PWA: manifest + ikonlar (192/512/maskable) + SW (offline → demo)
- [x] T605 Performans: throttle, format cache, memo, lazy chart
- [ ] T606 Lighthouse CI (Performance > 90, A11y > 95) — ⏸ (deploy sonrası)

## Faz 7 — Yayın
- [x] T701 CI (GitHub Actions): lint + test + build + e2e
- [x] T702 README (kurulum, komutlar, env, mimari özeti)
- [ ] T703 Deploy (Vercel/Netlify) — ⏸ (repo sahibinin hesabı gerekli)
- [ ] T704 Sentry / analytics — ⏸
- [ ] T705 Storybook — ⏸ (opsiyonel, brief'te önerili)
- [ ] T706 Capacitor native paketleme — ⏸
