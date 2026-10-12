# LANKA v2 — Mobil UX Başlangıç ve Yeniden Tasarım Ölçümleri (Baseline vs Redesign)

Tarih: 2026-10-12  
Ölçüm yöntemi: Playwright Headless Chromium (390×844, 360×640, 844×390)

---

## Özet Karşılaştırma Tablosu

| Metrik / Viewport | Baseline (Eski) | Redesign (Yeni) | İyileşme / Durum |
|---|---|---|---|
| **iPhone 13 (390×844)** | | | |
| Header Yüksekliği | 89.0px | **56.0px** | %37 azaldı (≤56px hedefi sağlandı) |
| İstatistik Şeridi / MetricsRow | 194.0px (4 kart) | **24.0px** (tek satır) | %87 dikey alan kazanıldı |
| Grafik Başlangıç $y$ (Top) | 368.7px (%43.7 fold) | **146.7px** (%17.4) | Grafik kat üstüne çıktı (hedef ≤%30) |
| Grafik Canvas Yüksekliği | 340.0px | **513.3px** (%60.8) | %51 büyüdü (hedef ≥%45) |
| BottomNav Üst $y$ | 779.0px | **787.0px** | — |
| PredictionCard Görünürlüğü | Fold altında / kesilmiş (y=729.7) | **Tamamen görünür** (y=720.0 - 764.0) | BottomNav üstünde 23px boşlukla tam görünür |
| Grafik / Nav Çakışması | Yok | **Yok** | Çakışma 0px |
| **Küçük Android (360×640)** | | | |
| Header Yüksekliği | 89.0px | **56.0px** | %37 azaldı |
| Grafik Başlangıç $y$ (Top) | 368.7px (%57.6) | **146.7px** (%22.9) | Kat üstünde |
| Grafik Canvas Yüksekliği | 340.0px (133.7px nav altında) | **309.3px** (tamamen nav üstünde) | Çakışma çözüldü, net yükseklik ≥260px |
| PredictionCard Görünürlüğü | Ekran dışında | **Görünür** (y=516.0 - 560.0) | Nav üstünde (navTop: 583.0px) |
| Grafik / Nav Çakışması | **133.7px çakışma (kapatıyordu)** | **0px (Çakışma yok)** | Temiz düzen |
| **iPhone 13 Yatay (844×390)** | | | |
| Header Yüksekliği | 89.0px (%22.8) | **36.0px** | Kompakt landscape header (≤40px) |
| BottomNav Yüksekliği | 57.0px | **37.0px** | Kompakt landscape nav |
| Grafik Canvas Yüksekliği | Fold altında ulaşılamaz | **220.0px** | Ekranın ana alanını kaplıyor |
| PredictionCard Görünürlüğü | Fold altında | **Görünür** (y=298.0 - 342.0) | Nav üstünde (navTop: 353.0px) |

---

## Detaylı Analiz

### 1. iPhone 13 (390×844 dikey)
- **Header**: Fiyat ve 24s değişim coin seçiciyle tek satıra indirildi (56px).
- **İstatistikler**: 4 kartlık dikey 194px blok, yatay kaydırılabilir 24px tek satır istatistik şeridine dönüştürüldü (24h Y/D, Hacim, Spread, Derinlik).
- **Zaman Dilimi (Timeframe)**: Header altındaki 40px blok kaldırıldı, doğrudan grafiğin üst araç çubuğuna taşındı.
- **Grafik**: Canvas yüksekliği 340px'den 513px'e yükseldi (%60.8 ekran payı).
- **Model Tahmin Kartı**: 182px sabit kart yerine tek satırlık (44px) interaktif özet şerit yerleştirildi. Şeride dokunulduğunda Vaul tabanlı `Bottom Sheet` modalı açılıyor.

### 2. Küçük Android (360×640 dikey)
- Eski düzende 133.7px oranında alt menünün (bottom nav) arkasında kalan grafik alanı tamamen nav üstüne taşındı (`chartBottom = 508px < navTop = 583px`).
- Tahmin şeridi ve grafik, 640px yükseklikte dahi dikey kaydırmaya gerek kalmadan ilk ekranda görünür hale geldi.

### 3. iPhone 13 Yatay / Landscape (844×390)
- `landscape:` Tailwind varyantları ile başlık 36px'e, alt menü 37px'e daraltıldı.
- Tam ekran butonu (T-P2-3) eklendi; tıklandığında tarayıcı Fullscreen API ve CSS fallback ile grafiği tüm ekrana yayıyor.

---

## Ekran Görüntüleri ve Artifacts

- Baseline:
  - `tests/e2e/__screenshots__/baseline-390x844.png`
  - `tests/e2e/__screenshots__/baseline-360x640.png`
  - `tests/e2e/__screenshots__/baseline-844x390.png`
- Redesign:
  - `tests/e2e/__screenshots__/new-390x844.png`
  - `tests/e2e/__screenshots__/new-360x640.png`
  - `tests/e2e/__screenshots__/new-844x390.png`
