# LANKA v2 — Mimari

## Katmanlar ve Import Kuralları

```
app/        → her şeye erişebilir (orkestrasyon)
features/*  → entities/* + shared/*  (feature ↔ feature YASAK — eslint-plugin-boundaries)
entities/*  → tipler (shared'a erişebilir)
shared/*    → en alt katman (feature/app'a erişemez)
```

Cross-feature runtime state `shared/model` içinde yaşar (zustand store'ları);
saf alan algoritmaları (duvar, feature, model, buckets) `shared/lib` içindedir ki
hem feature'lar hem worker hem worker'ın inline fallback'i aynı kodu kullansın.

## Veri Akışı

```mermaid
flowchart LR
  subgraph Feed ["market-feed (feature)"]
    LIVE["LiveFeed<br/>combined WS<br/>depth20@100ms + kline + ticker"]
    DEMO["DemoFeed<br/>seed'li RNG<br/>deterministik"]
    CTRL["createMarketFeed<br/>auto: 3 deneme/30sn → demo fallback<br/>backoff 1→30s, heartbeat, visibility"]
  end

  WS[(Binance WS)] --> LIVE
  REST[(Binance REST /klines)] --> LIVE
  CTRL --> LIVE
  CTRL --> DEMO

  CTRL -->|FeedEvent: status/book/candle/ticker/history| MS["marketStore<br/>(zustand, shared/model)"]

  MS -->|book+candles, 100ms throttle| WE["wallEngine<br/>(shared/lib)"]
  subgraph Worker ["Web Worker (inline fallback)"]
    WK["wallWorker<br/>detectWalls + WallTracker + computeFeatures"]
  end
  WE --> WK
  WK -->|walls + features| MS

  MS -->|kapalı mum| PE["predictionEngine<br/>(features/prediction)"]
  PE -->|predict/learn| MD["model (shared/lib)<br/>ağırlıklar, version"]
  PE -->|hit/miss/neutral + haptic + toast| LS["learningStore<br/>(shared/model)"]
  LS -->|persist| IDB[(IndexedDB<br/>idb-keyval)]
  IDB -->|load + v1→v2 migrasyon| LS
  IDB <--> PREF["preferences<br/>(coin, timeframe, tema)"]

  MS --> UI["React UI<br/>Grafik · Duvarlar · Kovalar · Hafıza"]
  LS --> UI
```

## Kritik Akışlar

### 1. Canlı veri döngüsü

1. `app/useFeed` → `createMarketFeed({mode:'auto', symbol, timeframe})`.
2. Live WS birleşik stream'den mesaj → zod doğrulama → `FeedEvent` → `marketStore.apply`.
3. Store 100 ms throttle ile `wallEngine.push({book, candles, config})` çağrır →
   worker `detectWalls` + `WallTracker.tick` + `computeFeatures` → sonucu store'a
   (`walls`, `features`) yazar. Main thread yalnızca render eder.
4. Kline kapanış (`k.x === true`) → `predictionEngine.handleClosedCandle`.

### 2. Tahmin / öğrenme döngüsü

1. Kapalı mum C geldi → önceki `pending` tahmin var mı?
   - `move = (C.close − basePrice) / basePrice`, `threshold = atrMoveFactor · ATR(14)`.
   - `|move| < 0.25·threshold` → neutral; değilse yön eşleşirse hit, yoksa miss.
   - `learn`: `target = sign(move)·min(1, |move|/threshold)`; ağırlıklar güncellenir.
   - istatistik + kova (band) + `recent[]` (≤30) güncellenir → IndexedDB persist.
   - toast + `navigator.vibrate(50)`.
2. Yeni tahmin: worker'ın son `features` (yoksa inline `computeFeatures`) →
   `predictWith(weights, features)` → `pending` olarak persist edilir
   (sayfa yenilense bile bir sonraki mumda çözülür).

### 3. Offline / hata senaryosu

- `!navigator.onLine` veya `VITE_DEMO_MODE=1` → doğrudan demo feed.
- WS 3 kez bağlanamaz / 30 sn mesaj yok → status `offline` → controller demo'ya düşer.
- StatusPill `DEMO` gösterir; pill'e dokunmak `forceLive()` ile yeniden canlı dener.
- PWA offline açılışta SW fallback index.html → uygulama `navigator.onLine=false` görüp
  demo modda ayağa kalkar.

## State Şeması (özet)

```ts
// marketStore (shared/model)
{ status, feedError, symbol, timeframe, price, ticker, book, candles[≤500], walls, features, lastEventAt }

// learningStore (shared/model) — sembol başına
{ weights: { version, values: {momentum, imbalance, wallPressure, trend, volatility} },
  stats: { total, hits, misses, neutrals, streak, bestStreak, lastUpdatedAt },
  recent: RecentValidation[≤30],
  buckets: { low, medium, high }: { band, total, hits, streak },
  pending: PendingPrediction | null }
```

## Thread Modeli

| Thread | İşler                                                                                    |
| ------ | ---------------------------------------------------------------------------------------- |
| Main   | React render, feed event dağıtımı (100ms throttle), store güncelleme, PWA                |
| Worker | `detectWalls` (20 satır), `WallTracker`, `computeFeatures` (≤500 mum), sonuç postMessage |

Worker'ın üretilemediği ortamlarda (test, bazı webview'lar) `wallEngine` aynı
`shared/lib` fonksiyonlarını main thread'de çalıştırır — davranış farkı yoktur.
