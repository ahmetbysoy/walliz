# LANKA v2 — Öğrenme Modeli

## Feature'lar

Tüm feature'lar **[-1, 1]** aralığına normalize edilir (öteleme katsayıları ATR bazlı
olduğundan coin'e adaptiftir).

| Feature        | Formül                                          | Yorum                                                                 |
| -------------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| `momentum`     | `tanh((P − P₋₆) / ATR / 1.5)`                   | Son 6 mumun ATR normlu net hareketi                                   |
| `imbalance`    | `(bidTop10 − askTop10) / (bidTop10 + askTop10)` | Kitap derinlik denges (üst 10 seviye)                                 |
| `wallPressure` | `clamp(Σbid güç/(1+dist) − Σask güç/(1+dist))`  | En yakın duvarların etkisi; yakın + güçlü bid duvarı destek → pozitif |
| `trend`        | `tanh((EMA5 − EMA20) / ATR)`                    | Kısa/uzun ortalama farkı                                              |
| `volatilite`   | `clamp01(ATR/P / 0.02) * 2 − 1`                 | Düşük volatilite → negatif, yüksek → pozitif (işaret model öğrenir)   |

`dist`, duvar fiyatının ATR cinsinden uzaklığıdır.

## Tahmin

```
score  = Σᵢ w · xᵢ
yön    = score > +0.15 → up ; score < −0.15 → down ; aksi → flat
güven  = clamp01(|score|)
```

Başlangıç ağırlıkları (önyargı: momentum/trend ağırlıklı):

```
momentum 0.50 · imbalance 0.40 · wallPressure 0.35 · trend 0.45 · volatility −0.10
```

## Öğrenme (online gradient descent)

Her mum kapanışında bir önceki `pending` tahmin çözülür:

```
move    = (closeₙ − basePrice)          # fiyat biriminde
target  = sign(move) · min(1, |move| / threshold)     # SÜREKLİ hedef (flat cezası düzeltmesi)
threshold = atrMoveFactor · ATR(14)                    # coin bazlı (BTC 0.35, DOGE 0.25 …)
error   = target − score(x)
wᵢ ← clamp(wᵢ + lr · error · xᵢ − decay · wᵢ, −2, +2)     # lr = 0.08, decay = 5e−4
```

- Hedefin sürekliliği, "küçük hareket → düz" durumlarında modelin aşırı ceza almasını önler.
- Sonuç sınıflaması (UI/istatistik için): `|move| < 0.25·threshold/P` → **neutral**;
  yön eşleşirse **hit**, aksi **miss**. `flat` tahminler her zaman neutral.

## Kovalar (pyramid buckets)

Her çözülme, tahminin güvenine göre kova'ya düşer:

```
high   ≥ 0.70
medium 0.40 – 0.70
low    < 0.40
```

Kovada `total / hits / streak` tutulur. Kovanın isabet oranı, modelin
o güven bandındaki kalibrasyonunu ölçer (yüksek güven kovasının isabeti düşüyorsa
model aşırı özgüvenli demektir).

## Versiyonlama ve Migrasyon

- `weights.version` (şu an `1`). Versiyon değişirse ağırlıklar sıfırdan başlar;
  istatistikler, kovalar ve `recent` korunur.
- v1 (eski vanilla sürüm) verisi otomatik migrate edilir:
  `{ weights: number[] | Record, stats: {total, correct, streak}, recent }` → v2 şeması.

## Kalıcılık

- `lanka:learning:{symbol}` (IndexedDB): weights, stats, recent (≤30), buckets, pending.
- Pending tahmin persist edilir → sayfa yenilense bile bir sonraki mumda çözülür.
- 90 günden eski `recent` kayıtları otomatik elenir.
- Export/Import: JSON (zod doğrulamalı).
